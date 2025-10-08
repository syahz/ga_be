import { logger } from '../utils/logger'
import { UserRequest } from '../type/user-request'
import { NextFunction, Request, Response } from 'express'
import { getUser, updateUser } from '../services/user-services'
import { UpdateAccountUserRequest, UserRole } from '../models/user-model'

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
export const details = async (req: UserRequest, res: Response, next: NextFunction) => {
  try {
    const userId = String(req.user?.id)
    const userRole = req.user?.role.name as UserRole
    logger.debug('User Role:', userRole)
    if (!userRole) {
      return res.status(403).send({ errors: 'Role not provided or invalid' })
    }
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(userId)) {
      return res.status(400).send({ errors: 'Invalid UUID format for User Id' })
    }

    const response = await getUser(userId, userRole)

    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

// Controller for update user account
export const user = async (req: UserRequest, res: Response, next: NextFunction) => {
  try {
    const userId = String(req.user?.id)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(userId)) {
      return res.status(400).send({ errors: 'Invalid UUID format for User Id' })
    }

    const request: UpdateAccountUserRequest = req.body as UpdateAccountUserRequest
    const response = await updateUser(userId, request)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

// Controller for update user password
export const password = async (req: UserRequest, res: Response, next: NextFunction) => {
  try {
    const userId = String(req.user?.id)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(userId)) {
      return res.status(400).send({ errors: 'Invalid UUID format for User Id' })
    }

    const request: UpdateAccountUserRequest = req.body as UpdateAccountUserRequest
    const response = await updateUser(userId, request)

    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}
