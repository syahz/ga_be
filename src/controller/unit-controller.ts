import { Request, Response, NextFunction } from 'express'
import { createUnit, getUnits, getAllUnits, getUnitById, updateUnit, deleteUnit } from '../services/unit-services'

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await createUnit(req.body)
    res.status(201).json({ data: response })
  } catch (e) {
    next(e)
  }
}

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const search = (req.query.search as string) || ''
    const response = await getUnits(page, limit, search)
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await getAllUnits()
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await getUnitById(req.params.unitId)
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await updateUnit(req.params.unitId, req.body)
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await deleteUnit(req.params.unitId)
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}
