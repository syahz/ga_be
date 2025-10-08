import { NextFunction, Response } from 'express'
import { UserRequest, UserWithRelations } from '../type/user-request'
import { CreateProcurementRequestDto, ProcessDecisionRequestDto } from '../models/procurement-model'
import { createProcurementLetter, getDashboardLetters, processDecisionLetter } from '../services/procurement-services'

export const create = async (req: UserRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user! as UserWithRelations
    const request: CreateProcurementRequestDto = req.body as CreateProcurementRequestDto
    const response = await createProcurementLetter(request, user)
    res.status(201).json({ data: response })
  } catch (e) {
    next(e)
  }
}

export const getDashboard = async (req: UserRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user! as UserWithRelations

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const search = (req.query.search as string) || ''

    const response = await getDashboardLetters(user, page, limit, search)
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}

export const processDecision = async (req: UserRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user! as UserWithRelations
    const letterId = req.params.letterId

    // Validasi format UUID
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(letterId)) {
      return res.status(400).send({ errors: 'Invalid UUID format for Letter Id' })
    }

    const request: ProcessDecisionRequestDto = req.body
    const response = await processDecisionLetter(letterId, request, user)
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}
