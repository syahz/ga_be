import express from 'express'
import { details, root, userUpdate, password } from '../../controller/user-controller'

const userRoutes = express.Router()

userRoutes.get('/foo', root)
userRoutes.get('/', details)
userRoutes.patch('/user', userUpdate)
userRoutes.patch('/password', password)

export default userRoutes
