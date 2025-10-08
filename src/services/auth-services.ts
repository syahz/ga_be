import { Response } from 'express'
import { signAccessToken } from '../utils/jwt'
import bcrypt from 'bcryptjs'
import { createRefreshToken, hashToken } from '../utils/token'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const REFRESH_EXPIRES_SECONDS = Number(process.env.REFRESH_TOKEN_EXPIRES_SECONDS || 60 * 60 * 24 * 30)

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: REFRESH_EXPIRES_SECONDS * 1000,
    path: '/'
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

  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt }
  })

  const csrfEnabled = process.env.CSRF_ENABLED === 'true'
  const csrfToken = csrfEnabled ? createRefreshToken().slice(0, 32) : null

  //Set Cookies refresh token
  res.cookie('refresh_token', refreshPlain, cookieOptions())

  // Set user role cookie
  res.cookie('user_role', role, {
    maxAge: REFRESH_EXPIRES_SECONDS * 1000,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  })

  // Set user unit cookie
  res.cookie('user_unit', unit, {
    maxAge: REFRESH_EXPIRES_SECONDS * 1000,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  })
  // Set CSRF token cookie if enabled
  if (csrfEnabled && csrfToken) {
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: REFRESH_EXPIRES_SECONDS * 1000,
      path: '/'
    })
  }

  return { accessToken, user: { id: user.id, name: user.name, email: user.email, role } }
}

export const refreshAuth = async (rt: string | undefined, res: Response) => {
  if (!rt) throw new Error('No refresh token')

  const tokenHash = hashToken(rt)
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  })

  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    if (stored && stored.revoked) {
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId },
        data: { revoked: true }
      })
      console.warn(`Refresh token reuse detected for user ${stored.userId}`)
    }

    res.clearCookie('refresh_token', { path: '/auth/refresh' })
    if (process.env.CSRF_ENABLED === 'true') res.clearCookie('csrf_token', { path: '/' })
    throw new Error('Invalid refresh token')
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } })

  const newPlain = createRefreshToken()
  const newHash = hashToken(newPlain)
  const newExpires = new Date(Date.now() + REFRESH_EXPIRES_SECONDS * 1000)

  const newTokenRow = await prisma.refreshToken.create({
    data: { userId: stored.userId, tokenHash: newHash, expiresAt: newExpires }
  })

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { replacedBy: newTokenRow.id }
  })

  const user = await prisma.user.findUnique({
    where: { id: stored.userId },
    include: {
      role: true,
      unit: true
    }
  })
  const role = user!.role.name
  const unit = user!.unit.name
  const accessToken = signAccessToken({ userId: user!.id, role })

  //Set Cookies refresh token
  res.cookie('refresh_token', newPlain, cookieOptions())
  // Set user unit cookie
  res.cookie('user_unit', unit, {
    maxAge: REFRESH_EXPIRES_SECONDS * 1000,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  })
  // Set user role cookie
  res.cookie('user_role', role, {
    maxAge: REFRESH_EXPIRES_SECONDS * 1000,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  })
  // Set CSRF token cookie if enabled
  if (process.env.CSRF_ENABLED === 'true') {
    const csrfToken = createRefreshToken().slice(0, 32)
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: REFRESH_EXPIRES_SECONDS * 1000,
      path: '/'
    })
  }

  return { accessToken, user: { id: user!.id, name: user!.name, email: user!.email, role } }
}

export const logoutAuth = async (rt: string | undefined, res: Response) => {
  if (rt) {
    const tokenHash = hashToken(rt)
    await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } })
    res.clearCookie('refresh_token', { path: '/' })
    res.clearCookie('user_unit', { path: '/' })
    if (process.env.CSRF_ENABLED === 'true') res.clearCookie('csrf_token', { path: '/' })
    res.clearCookie('user_role', { path: '/' })
  }
  return { ok: true }
}
