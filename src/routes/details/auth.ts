import express from 'express'
import { sso, refresh, logout } from '../../controller/auth-controller'

const authRoutes = express.Router()

authRoutes.post('/sso/callback', sso)
authRoutes.post('/refresh', refresh)
authRoutes.delete('/logout', logout)

export default authRoutes
