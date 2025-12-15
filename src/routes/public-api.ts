import express from 'express'
import '../config/passport-setup'
import authRoutes from './details/auth'
import { getProcurementLetterFile, getProgress } from '../controller/procurement-controller'

export const publicRouter = express.Router()

publicRouter.use('/api/auth', authRoutes)
publicRouter.get('/api/progress/:letterId', getProgress)
publicRouter.get('/api/letters/:fileName', getProcurementLetterFile)
