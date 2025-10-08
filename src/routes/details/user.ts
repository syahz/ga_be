import express from 'express'
import { details, root, user, password } from '../../controller/user-controller'

const userRoutes = express.Router()

userRoutes.get('/foo', root)
userRoutes.get('/', details)
userRoutes.patch('/user', user)
userRoutes.patch('/password', password)

export default userRoutes
