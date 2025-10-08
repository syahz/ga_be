import express from 'express'
const procurementRoutes = express.Router()
import { create, getDashboard, processDecision } from '../../controller/procurement-controller'

procurementRoutes.post('/', create)
procurementRoutes.get('/', getDashboard)
procurementRoutes.post('/decision/:letterId', processDecision)

export default procurementRoutes
