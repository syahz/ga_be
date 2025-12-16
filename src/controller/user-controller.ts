import { logger } from '../utils/logger'
import { UserRequest, UserWithRelations } from '../type/user-request'
import { NextFunction, Request, RequestHandler, Response } from 'express'
import { getUser, updateUser } from '../services/user-services'
import { UpdateAccountUserRequest } from '../models/user-model'

export const root = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({
      data: 'OK'
    })
  } catch (e) {
    next(e)
  }
}

// Controller for get user details
export const details: RequestHandler = async (req, res: Response, next: NextFunction) => {
  try {
    const user = (req as UserRequest).user! as UserWithRelations
    const userId = String(user.id)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(userId)) {
      return res.status(400).send({ errors: 'Invalid UUID format for User Id' })
    }

    const response = await getUser(userId)

    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

// Controller for update user account
export const userUpdate: RequestHandler = async (req, res: Response, next: NextFunction) => {
  try {
    const user = (req as UserRequest).user! as UserWithRelations
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(user.id)) {
      return res.status(400).send({ errors: 'Invalid UUID format for User Id' })
    }

    const request: UpdateAccountUserRequest = req.body as UpdateAccountUserRequest
    const response = await updateUser(user.id, request)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}
