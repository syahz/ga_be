import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken'

const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES || '15m'

export interface AccessPayload {
  userId: string
  role: string
}

export function signAccessToken(payload: AccessPayload) {
  const secret = process.env.ACCESS_TOKEN_SECRET
  if (!secret) throw new Error('ACCESS_TOKEN_SECRET not set')

  const options: SignOptions = { expiresIn: ACCESS_EXPIRES as any }
  return jwt.sign(payload, secret, options)
}

export function verifyAccessToken(token: string): JwtPayload & AccessPayload {
  const secret = process.env.ACCESS_TOKEN_SECRET
  if (!secret) throw new Error('ACCESS_TOKEN_SECRET not set')

  return jwt.verify(token, secret) as JwtPayload & AccessPayload
}
