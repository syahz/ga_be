import { Request, Response } from 'express'
import { ssoLoginAuth, logoutAuth, refreshAuth } from '../services/auth-services'

export async function sso(req: Request, res: Response) {
  try {
    const { code } = req.body
    const response = await ssoLoginAuth(code, res)
    res.status(200).json({ data: response })
  } catch (err: any) {
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
