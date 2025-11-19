import { Response } from 'express'
import { signAccessToken } from '../utils/jwt'
import bcrypt from 'bcryptjs'
import { createRefreshToken, hashToken } from '../utils/token'
import { PrismaClient, Role, Unit, User } from '@prisma/client'

const prisma = new PrismaClient()

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

function cookieOptionsGoogleCallback() {
  // Cross-site redirect callback requires SameSite=None and secure
  return withDomain({
    httpOnly: true,
    secure: true,
    sameSite: 'none' as const,
    maxAge: REFRESH_EXPIRES_SECONDS * 1000,
    path: '/'
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
    await prisma.refreshToken.deleteMany({ where: { userId } })
  } else {
    // Prune expired or revoked tokens for cleanliness
    await prisma.refreshToken.deleteMany({ where: { userId, OR: [{ revoked: true }, { expiresAt: { lt: new Date() } }] } })
  }
}

export const loginAuth = async (email: string, password: string, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      role: true,
      unit: true
    }
  })
  if (!user) throw new Error('Invalid credentials')
  if (user.isLocked) throw new Error('Account locked')

  const match = await bcrypt.compare(password, user.password)
  if (!match) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: user.failedLogins + 1 }
    })
    throw new Error('Invalid credentials')
  }

  if (user.failedLogins > 0) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0 } })
  }

  const role = user.role.name
  const unit = user.unit.name
  const accessToken = signAccessToken({ userId: user.id, role })

  const refreshPlain = createRefreshToken()
  const tokenHash = hashToken(refreshPlain)
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_SECONDS * 1000)

  // Ensure old tokens are cleared to avoid piling up
  await resetUserRefreshTokens(user.id)

  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt }
  })

  const csrfEnabled = process.env.CSRF_ENABLED === 'true'
  const csrfToken = csrfEnabled ? createRefreshToken().slice(0, 32) : null

  //Set Cookies refresh token
  res.cookie('refresh_token', refreshPlain, cookieOptions())

  // Set user role cookie
  res.cookie('user_role', role, nonHttpOnlyCookieOptions())

  // Set user unit cookie
  res.cookie('user_unit', unit, nonHttpOnlyCookieOptions())
  // Set CSRF token cookie if enabled
  if (csrfEnabled && csrfToken) {
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

  return { accessToken, user: { id: user.id, name: user.name, email: user.email, role, unit: user.unit.name } }
}

export const loginWithGoogle = async (user: User & { role: Role; unit: Unit }, res: Response) => {
  if (!user) {
    throw new Error('User not provided for Google login')
  }

  const role = user.role.name
  const unit = user.unit.name

  const accessToken = signAccessToken({ userId: user.id, role })

  const refreshPlain = createRefreshToken()
  const tokenHash = hashToken(refreshPlain)
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_SECONDS * 1000)

  // Ensure old tokens are cleared to avoid piling up (same behavior as normal login)
  await resetUserRefreshTokens(user.id)

  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt }
  })

  // Set semua cookie yang diperlukan
  res.cookie('refresh_token', refreshPlain, cookieOptionsGoogleCallback())
  res.cookie('user_role', role, nonHttpOnlyCookieOptions())
  res.cookie('user_unit', unit, nonHttpOnlyCookieOptions())

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

  return { accessToken, user: { id: user.id, name: user.name, email: user.email, role, unit: user.unit.name } }
}

export const refreshAuth = async (rt: string | undefined, res: Response) => {
  if (!rt) {
    throw new Error('No refresh token')
  }

  const tokenHash = hashToken(rt)
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash }
  })

  // Jika token tidak ada, sudah dicabut (dari logout), atau kedaluwarsa
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    // Clear both host-only and domain-scoped cookies to avoid duplicates
    res.clearCookie('refresh_token', { path: '/' })
    if (COOKIE_DOMAIN) res.clearCookie('refresh_token', { path: '/', domain: COOKIE_DOMAIN })
    res.clearCookie('user_unit', { path: '/' })
    if (COOKIE_DOMAIN) res.clearCookie('user_unit', { path: '/', domain: COOKIE_DOMAIN })
    res.clearCookie('user_role', { path: '/' })
    if (COOKIE_DOMAIN) res.clearCookie('user_role', { path: '/', domain: COOKIE_DOMAIN })
    if (process.env.CSRF_ENABLED === 'true') {
      res.clearCookie('csrf_token', { path: '/' })
      if (COOKIE_DOMAIN) res.clearCookie('csrf_token', { path: '/', domain: COOKIE_DOMAIN })
    }
    throw new Error('Invalid or expired refresh token')
  }

  const newPlain = createRefreshToken()
  const newHash = hashToken(newPlain)
  const newExpires = new Date(Date.now() + REFRESH_EXPIRES_SECONDS * 1000)

  const user = await prisma.user.findUnique({
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
    await prisma.$transaction([
      // 1. Hapus token lama yang baru saja kita gunakan
      prisma.refreshToken.delete({
        where: { id: stored.id }
      }),

      // 2. Buat token baru untuk menggantikannya
      prisma.refreshToken.create({
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
    await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } })
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
