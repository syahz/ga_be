import { Request, Response, NextFunction } from 'express'
import { createRole, getRoles, getAllRoles, getRoleById, updateRole, deleteRole } from '../services/role-services'
import { CreateRoleRequest } from '../models/role-model'
import { UpdateRuleRequest } from '../models/rule-model'

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request: CreateRoleRequest = req.body as CreateRoleRequest
    const response = await createRole(request)
    res.status(201).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const search = (req.query.search as string) || ''
    const response = await getRoles(page, limit, search)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await getAllRoles()
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = String(req.params.roleId)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(roleId)) {
      return res.status(400).send({ errors: 'Invalid UUID format for Role Id' })
    }
    const response = await getRoleById(roleId)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = String(req.params.roleId)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(roleId)) {
      return res.status(400).send({ errors: 'Invalid UUID format for Role Id' })
    }
    const request: UpdateRuleRequest = req.body as UpdateRuleRequest
    const response = await updateRole(roleId, request)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = String(req.params.roleId)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(roleId)) {
      return res.status(400).send({ errors: 'Invalid UUID format for Role Id' })
    }
    const response = await deleteRole(roleId)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}
