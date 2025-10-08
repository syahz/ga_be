import { Request, Response } from 'express'
import { loginAuth, logoutAuth, refreshAuth } from '../services/auth-services'

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body
    const result = await loginAuth(email, password, res)
    res.json(result)
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
