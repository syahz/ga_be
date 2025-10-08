import express from 'express'
import { create, get, getAll, getById, update, remove } from '../../controller/role-controller'

const roleRoutes = express.Router()

roleRoutes.post('/', create)
roleRoutes.get('/', get)
roleRoutes.get('/all', getAll)
roleRoutes.get('/:roleId', getById)
roleRoutes.put('/:roleId', update)
roleRoutes.delete('/:roleId', remove)

export default roleRoutes
