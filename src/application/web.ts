import path from 'path'
import express from 'express'
import cors from 'cors'
import { FRONTEND_URL } from '../config/index'
import { publicRouter } from '../routes/public-api'
import { privateRouter } from '../routes/private-api'
import cookieParser from 'cookie-parser'
import { errorMiddleware } from '../middleware/error-middleware'

export const web = express()

const corsOptions = {
  origin: FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true
}
web.use('/uploads', express.static(path.join(__dirname, '../../uploads')))
web.use(cors(corsOptions))
web.use(cookieParser())
web.use(express.json())
web.use(publicRouter)
web.use(privateRouter)
web.use(errorMiddleware)
