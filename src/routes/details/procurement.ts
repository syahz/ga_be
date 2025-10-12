import express from 'express'
import { procurement_letter_upload } from '../../middleware/upload-middleware'
import { create, getDashboard, processDecision, getProcurementLetterFile } from '../../controller/procurement-controller'

const procurementRoutes = express.Router()

procurementRoutes.get('/', getDashboard)
procurementRoutes.post('/', procurement_letter_upload, create)
procurementRoutes.post('/decision/:letterId', processDecision)
procurementRoutes.get('/letters/:fileName', getProcurementLetterFile)

export default procurementRoutes
