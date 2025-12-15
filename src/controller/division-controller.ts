import { Request, Response, NextFunction } from 'express'
import { CreateDivisionRequest, UpdateDivisionRequest } from '../models/division-model'
import { createDivision, getDivisions, getAllDivisions, getDivisionById, updateDivision, deleteDivision } from '../services/division-services'

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request: CreateDivisionRequest = req.body as CreateDivisionRequest
    const response = await createDivision(request)
    res.status(201).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const divisionId = String(req.params.divisionId)
    const request: UpdateDivisionRequest = req.body as UpdateDivisionRequest
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(divisionId)) {
      return res.status(400).send({ errors: 'Invalid UUID format for Division Id' })
    }
    const response = await updateDivision(divisionId, request)
    res.status(200).json({
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
    const response = await getDivisions(page, limit, search)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await getAllDivisions()
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const divisionId = String(req.params.divisionId)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(divisionId)) {
      return res.status(400).send({ errors: 'Invalid UUID format for Division Id' })
    }
    const response = await getDivisionById(divisionId)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const divisionId = String(req.params.divisionId)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(divisionId)) {
      return res.status(400).send({ errors: 'Invalid UUID format for Division Id' })
    }
    const response = await deleteDivision(divisionId)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}
