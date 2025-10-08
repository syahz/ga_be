import express from 'express'
import { get, details, create, remove, update } from '../../controller/participant-controller'

const participantRoutes = express.Router()

participantRoutes.get('/', get)
participantRoutes.post('/', create)
participantRoutes.get('/:participantId', details)
participantRoutes.patch('/:participantId', update)
participantRoutes.delete('/:participantId', remove)

export default participantRoutes
