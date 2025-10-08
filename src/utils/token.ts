import crypto from 'crypto'

export function createRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex') // secure random
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
