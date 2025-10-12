import { logger } from '../utils/logger'
import { verifyAccessToken } from '../utils/jwt'
import { Response, NextFunction, RequestHandler } from 'express'
import { prismaClient } from '../application/database'
import { UserRequest, UserWithRelations } from '../type/user-request'

export const authRequired: RequestHandler = async (req, res: Response, next: NextFunction) => {
  const authHeader = req.header('authorization')
  if (!authHeader) {
    res.status(401).json({ error: 'Missing Authorization header' })
    return
  }
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ error: 'Invalid Authorization header' })
    return
  }
  try {
    const payload: any = verifyAccessToken(parts[1])
    const user = await prismaClient.user.findUnique({
      where: { id: payload.userId },
      include: { role: true, unit: true }
    })

    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }
    ;(req as UserRequest).user = user as UserWithRelations
    next()
  } catch (err) {
    logger.error('JWT verify error:', err)
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
