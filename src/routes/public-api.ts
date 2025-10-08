import express from 'express'
import authRoutes from './details/auth'

export const publicRouter = express.Router()

publicRouter.use('/api/auth', authRoutes)
