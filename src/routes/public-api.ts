import express from 'express'
import '../config/passport-setup'
import authRoutes from './details/auth'
import passport from 'passport'
import { loginWithGoogleCallback } from '../controller/auth-controller'
import { getProcurementLetterFile, getProgress } from '../controller/procurement-controller'

export const publicRouter = express.Router()

publicRouter.use('/api/auth', authRoutes)
publicRouter.get('/api/progress/:letterId', getProgress)
publicRouter.get('/api/letters/:fileName', getProcurementLetterFile)
publicRouter.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }))

publicRouter.get(
  '/api/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=unregistered_email`,
    session: false
  }),
  loginWithGoogleCallback
)
