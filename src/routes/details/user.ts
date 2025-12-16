import express from 'express'
import { details, root, userUpdate } from '../../controller/user-controller'

const userRoutes = express.Router()

userRoutes.get('/foo', root)
userRoutes.get('/', details)
userRoutes.patch('/user', userUpdate)

export default userRoutes
