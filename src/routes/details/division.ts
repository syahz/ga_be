import express from 'express'
import { create, get, getAll, getById, update, remove } from '../../controller/division-controller'

const divisionRoutes = express.Router()

divisionRoutes.get('/', get)
divisionRoutes.post('/', create)
divisionRoutes.get('/all', getAll)
divisionRoutes.put('/:divisionId', update)
divisionRoutes.get('/:divisionId', getById)
divisionRoutes.delete('/:divisionId', remove)

export default divisionRoutes
