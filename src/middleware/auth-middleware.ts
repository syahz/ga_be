import { logger } from '../utils/logger'
import { verifyAccessToken } from '../utils/jwt'
import { Response, NextFunction } from 'express'
import { prismaClient } from '../application/database'
import { UserRequest, UserWithRelations } from '../type/user-request'

export async function authRequired(req: UserRequest, res: Response, next: NextFunction) {
  const authHeader = req.header('authorization')
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' })
  const parts = authHeader.split(' ')
  logger.debug(JSON.stringify(parts[1], null, 2))
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid Authorization header' })
  try {
    const payload: any = verifyAccessToken(parts[1])
    const user = await prismaClient.user.findUnique({
      where: { id: payload.userId },
      include: { role: true, unit: true }
    })

    if (!user) return res.status(401).json({ error: 'User not found' })
    req.user = user as UserWithRelations
    return next()
  } catch (err) {
    logger.error('JWT verify error:', err)
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// export function requireRoles(...allowed: string) {
//   return (req: AuthRequest, res: Response, next: NextFunction) => {
//     if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
//     const ok = req.user.roles.includes(allowed)
//     if (!ok) return res.status(403).json({ error: 'Forbidden' })
//     next()
//   }
// }
