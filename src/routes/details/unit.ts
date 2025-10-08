import express from 'express'
import { create, get, getAll, getById, update, remove } from '../../controller/unit-controller'

const unitRoutes = express.Router()

unitRoutes.get('/', get)
unitRoutes.get('/all', getAll)
unitRoutes.post('/', create)
unitRoutes.get('/:unitId', getById)
unitRoutes.put('/:unitId', update)
unitRoutes.delete('/:unitId', remove)

export default unitRoutes
