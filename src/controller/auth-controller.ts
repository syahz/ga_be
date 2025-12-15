import { logger } from '../utils/logger'
import { Request, Response } from 'express'
import requestIp from 'request-ip'
import { loginAuth, logoutAuth, refreshAuth } from '../services/auth-services'

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body
    const result = await loginAuth(email, password, res)

    if (result && result.user) {
      // const xForwardedFor = req.headers['x-forwarded-for']
      // const xRealIp = req.headers['x-real-ip']
      // logger.debug(`Raw Headers - X-Forwarded-For: ${xForwardedFor}, X-Real-IP: ${xRealIp}, Remote Address (socket): ${req.socket.remoteAddress}`)
      // ============================
      // const ip = requestIp.getClientIp(req)
      // const userAgent = req.get('User-Agent') || 'unknown'
      // logger.info(`Login successful for user: ${result.user.email} (ID: ${result.user.id}). ` + `IP: ${ip}, User-Agent: ${userAgent}`)
    }

    res.json(result)
  } catch (err: any) {
    const ip = requestIp.getClientIp(req)
    logger.warn(`Login failed for email: ${req.body.email}. IP: ${ip}. Reason: ${err.message}`)
    res.status(401).json({ error: err.message })
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const result = await refreshAuth(req.cookies['refresh_token'], res)
    res.json(result)
  } catch (err: any) {
    res.status(401).json({ error: err.message })
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const result = await logoutAuth(req.cookies['refresh_token'], res)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
