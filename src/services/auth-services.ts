import { Response } from 'express'
import { logger } from '../utils/logger'
import { signAccessToken } from '../utils/jwt'
import axios from 'axios'
import { prismaClient } from '../application/database'
import { ResponseError } from '../error/response-error'
import { createRefreshToken, hashToken } from '../utils/token'
import { CLIENT_ID, CLIENT_SECRET, CSRF_ENABLED, NODE_ENV, PORTAL_API_URL } from '../config'

const REFRESH_EXPIRES_SECONDS = Number(process.env.REFRESH_TOKEN_EXPIRES_SECONDS || 60 * 60 * 24 * 30)
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN
const SINGLE_SESSION = (process.env.SINGLE_SESSION || 'true').toLowerCase() === 'true'

function withDomain<T extends Record<string, any>>(opts: T): T & { domain?: string } {
  return COOKIE_DOMAIN ? { ...opts, domain: COOKIE_DOMAIN } : opts
}

function cookieOptions() {
  // Host-scope or domain-scope depending on COOKIE_DOMAIN
  return withDomain({
    // return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: REFRESH_EXPIRES_SECONDS * 1000,
    path: '/'
    // }
  })
}

function nonHttpOnlyCookieOptions() {
  return withDomain({
    // return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: REFRESH_EXPIRES_SECONDS * 1000,
    path: '/'
    // }
  })
}

async function resetUserRefreshTokens(userId: string) {
  // To prevent piling up refresh tokens, either enforce single-session or prune old tokens.
  if (SINGLE_SESSION) {
    await prismaClient.refreshToken.deleteMany({ where: { userId } })
  } else {
    // Prune expired or revoked tokens for cleanliness
    await prismaClient.refreshToken.deleteMany({ where: { userId, OR: [{ revoked: true }, { expiresAt: { lt: new Date() } }] } })
  }
}

export const ssoLoginAuth = async (code: string, res: Response) => {
  type PortalTokenResponse = {
    user: {
      id: string
      email: string
      name: string
      role: string
      unit_code: string
      division_name: string
    }
    portal_refresh_expires_ts: string | null
  }

  try {
    const tokenResponse = await axios.post<PortalTokenResponse>(`${PORTAL_API_URL}/auth/token`, {
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    })

    const payload: any = tokenResponse.data
    const portalUser = payload?.user ?? payload?.data?.user
    if (!portalUser) {
      logger.error('Portal user missing in token response')
      return res.status(500).json({ error: code })
    }

    const role = await prismaClient.role.findUnique({ where: { name: portalUser.role } })
    const unit = await prismaClient.unit.findUnique({ where: { code: portalUser.unit_code } })
    const division = await prismaClient.division.findUnique({ where: { name: portalUser.division_name } })

    if (!role || !unit || !division) {
      throw new ResponseError(400, 'Data Master (Role/Unit/Divisi) belum tersinkronisasi di sistem Feedback')
    }

    const localUser = await prismaClient.user.upsert({
      where: { email: portalUser.email },
      update: {
        id: portalUser.id,
        name: portalUser.name,
        roleId: role.id,
        unitId: unit.id,
        divisionId: division.id
      },
      create: {
        id: portalUser.id,
        email: portalUser.email,
        name: portalUser.name,
        roleId: role.id,
        unitId: unit.id,
        divisionId: division.id
      }
    })

    const accessToken = signAccessToken({ userId: localUser.id, role: role.name })
    const refreshPlain = createRefreshToken()
    const tokenHash = hashToken(refreshPlain)
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_SECONDS * 1000)

    await resetUserRefreshTokens(portalUser.id)

    await prismaClient.refreshToken.create({
      data: { userId: localUser.id, tokenHash, expiresAt }
    })

    const csrfEnabled = process.env.CSRF_ENABLED === 'true'
    const csrfToken = csrfEnabled ? createRefreshToken().slice(0, 32) : null

    res.cookie('refresh_token', refreshPlain, cookieOptions())
    // Cookies should store names
    res.cookie('user_role', role.name, nonHttpOnlyCookieOptions())
    res.cookie('user_unit', unit.name, nonHttpOnlyCookieOptions())
    res.cookie('user_division', division.name, nonHttpOnlyCookieOptions())

    if (csrfEnabled && csrfToken) {
      res.cookie(
        'csrf_token',
        csrfToken,
        withDomain({
          httpOnly: false,
          secure: NODE_ENV === 'production',
          sameSite: 'strict' as const,
          maxAge: REFRESH_EXPIRES_SECONDS * 1000,
          path: '/'
        })
      )
    }

    return {
      accessToken,
      user: {
        id: localUser.id,
        name: localUser.name,
        email: localUser.email,
        role: role.name,
        unit: unit.name,
        division: division.name
      }
    }
  } catch (error: any) {
    // Log detailed axios error info
    if (axios.isAxiosError(error)) {
      logger.error('SSO login failed (axios)', JSON.stringify({ error: error }))
    } else {
      logger.error('SSO login failed (unknown)', JSON.stringify({ message: error?.message, stack: error?.stack }))
    }
    logger.error(error)
    return res.status(500).json({ error: error })
  }
}

export const refreshAuth = async (rt: string | undefined, res: Response) => {
  if (!rt) {
    throw new Error('No refresh token')
  }

  const tokenHash = hashToken(rt)
  const stored = await prismaClient.refreshToken.findUnique({
    where: { tokenHash }
  })

  // Jika token tidak ada, sudah dicabut (dari logout), atau kedaluwarsa
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    // Clear both host-only and domain-scoped cookies to avoid duplicates
    res.clearCookie('refresh_token', { path: '/' })
    if (COOKIE_DOMAIN) res.clearCookie('refresh_token', { path: '/', domain: COOKIE_DOMAIN })
    res.clearCookie('portal_session', { path: '/' })
    if (COOKIE_DOMAIN) res.clearCookie('portal_session', { path: '/', domain: COOKIE_DOMAIN })
    res.clearCookie('user_unit', { path: '/' })
    if (COOKIE_DOMAIN) res.clearCookie('user_unit', { path: '/', domain: COOKIE_DOMAIN })
    res.clearCookie('user_role', { path: '/' })
    if (COOKIE_DOMAIN) res.clearCookie('user_role', { path: '/', domain: COOKIE_DOMAIN })
    res.clearCookie('user_division', { path: '/' })
    if (COOKIE_DOMAIN) res.clearCookie('user_division', { path: '/', domain: COOKIE_DOMAIN })
    if (CSRF_ENABLED === 'true') {
      res.clearCookie('csrf_token', { path: '/' })
      if (COOKIE_DOMAIN) res.clearCookie('csrf_token', { path: '/', domain: COOKIE_DOMAIN })
    }
    throw new ResponseError(400, 'Invalid or expired refresh token')
  }

  const newPlain = createRefreshToken()
  const newHash = hashToken(newPlain)
  const newExpires = new Date(Date.now() + REFRESH_EXPIRES_SECONDS * 1000)

  const user = await prismaClient.user.findUnique({
    where: { id: stored.userId },
    include: {
      role: true,
      unit: true
    }
  })

  if (!user) {
    throw new Error('User for token not found')
  }

  try {
    await prismaClient.$transaction([
      // 1. Hapus token lama yang baru saja kita gunakan
      prismaClient.refreshToken.delete({
        where: { id: stored.id }
      }),

      // 2. Buat token baru untuk menggantikannya
      prismaClient.refreshToken.create({
        data: {
          userId: stored.userId,
          tokenHash: newHash,
          expiresAt: newExpires
        }
      })
    ])
  } catch (error) {
    console.error('Refresh token transaction failed', error)
    throw new Error('Failed to rotate refresh token')
  }

  const role = user.role.name
  const unit = user.unit.name
  const accessToken = signAccessToken({ userId: user.id, role })

  // Set semua cookie baru (clear potential host-only duplicate first)
  res.clearCookie('refresh_token', { path: '/' })
  if (COOKIE_DOMAIN) res.clearCookie('refresh_token', { path: '/', domain: COOKIE_DOMAIN })
  res.cookie('refresh_token', newPlain, cookieOptions())
  res.cookie('user_unit', unit, nonHttpOnlyCookieOptions())
  res.cookie('user_role', role, nonHttpOnlyCookieOptions())

  // Set CSRF token baru jika diaktifkan
  if (process.env.CSRF_ENABLED === 'true') {
    const csrfToken = createRefreshToken().slice(0, 32)
    res.cookie(
      'csrf_token',
      csrfToken,
      withDomain({
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge: REFRESH_EXPIRES_SECONDS * 1000,
        path: '/'
      })
    )
  }

  return {
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      unit: user.unit.name
    }
  }
}

export const logoutAuth = async (rt: string | undefined, res: Response) => {
  if (rt) {
    const tokenHash = hashToken(rt)
    await prismaClient.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } })
    // Clear both host-only and domain cookies to fully remove
    res.clearCookie('refresh_token', { path: '/' })
    if (COOKIE_DOMAIN) res.clearCookie('refresh_token', { path: '/', domain: COOKIE_DOMAIN })
    res.clearCookie('user_unit', { path: '/' })
    if (COOKIE_DOMAIN) res.clearCookie('user_unit', { path: '/', domain: COOKIE_DOMAIN })
    if (process.env.CSRF_ENABLED === 'true') {
      res.clearCookie('csrf_token', { path: '/' })
      if (COOKIE_DOMAIN) res.clearCookie('csrf_token', { path: '/', domain: COOKIE_DOMAIN })
    }
    res.clearCookie('user_role', { path: '/' })
    if (COOKIE_DOMAIN) res.clearCookie('user_role', { path: '/', domain: COOKIE_DOMAIN })
  }
  return { ok: true }
}
