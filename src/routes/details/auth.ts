import express from 'express'
import { login, refresh, logout } from '../../controller/auth-controller'

const authRoutes = express.Router()

authRoutes.post('/login', login)
authRoutes.post('/refresh', refresh)
authRoutes.delete('/logout', logout)

export default authRoutes
