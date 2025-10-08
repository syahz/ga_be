import { Request, Response, NextFunction } from 'express'

export function csrfDoubleSubmit(req: Request, res: Response, next: NextFunction) {
  if (process.env.CSRF_ENABLED !== 'true') return next()
  // check header vs cookie
  const csrfHeader = req.header('x-csrf-token')
  const csrfCookie = req.cookies['csrf_token']
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    return res.status(403).json({ error: 'Invalid CSRF token' })
  }
  next()
}
