import express from 'express'
import {
  create,
  update,
  getDetails,
  getProcurements,
  processDecision,
  getDashboardUser,
  getDashboardAdmin,
  getHistoryProcurements
} from '../../controller/procurement-controller'
import { procurement_letter_upload } from '../../middleware/upload-middleware'

const procurementRoutes = express.Router()

procurementRoutes.get('/', getProcurements)
procurementRoutes.get('/dashboardadmin', getDashboardAdmin)
procurementRoutes.get('/dashboard', getDashboardUser)
procurementRoutes.get('/history', getHistoryProcurements)
procurementRoutes.get('/:letterId', getDetails)
procurementRoutes.post('/', procurement_letter_upload, create)
procurementRoutes.post('/decision/:letterId', processDecision)
procurementRoutes.put('/:letterId', procurement_letter_upload, update)

export default procurementRoutes
