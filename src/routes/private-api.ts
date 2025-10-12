import express from 'express'
import unitRoutes from './details/unit'
import userRoutes from './details/user'
import roleRoutes from './details/role'
import ruleRoutes from './details/rule'
import procurementRoutes from './details/procurement'
import participantRoutes from './details/participant'
import { authRequired } from '../middleware/auth-middleware'

export const privateRouter = express.Router()

privateRouter.use(authRequired)

privateRouter.use('/api/admin/user', userRoutes)
privateRouter.use('/api/admin/roles', roleRoutes)
privateRouter.use('/api/admin/units', unitRoutes)
privateRouter.use('/api/admin/rules', ruleRoutes)
privateRouter.use('/api/admin/procurements', procurementRoutes)
privateRouter.use('/api/admin/participants', participantRoutes)
