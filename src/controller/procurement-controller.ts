import { ResponseError } from '../error/response-error'
import { NextFunction, Response, RequestHandler } from 'express'
import { UserRequest, UserWithRelations } from '../type/user-request'
import { CreateProcurementRequestDto, ProcessDecisionRequestDto } from '../models/procurement-model'
import { createProcurementLetter, getDashboardLetters, getProcurementLetterPath, processDecisionLetter } from '../services/procurement-services'

export const create: RequestHandler = async (req, res: Response, next: NextFunction) => {
  try {
    const user = (req as UserRequest).user! as UserWithRelations
    const request: CreateProcurementRequestDto = req.body as CreateProcurementRequestDto

    if (!req.file) {
      throw new ResponseError(400, 'File surat (letter_file) wajib diunggah.')
    }

    request.letterFile = req.file.filename
    const response = await createProcurementLetter(request, user)
    res.status(201).json({ data: response })
  } catch (e) {
    next(e)
  }
}

export const getDashboard: RequestHandler = async (req, res: Response, next: NextFunction) => {
  try {
    const user = (req as UserRequest).user! as UserWithRelations

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const search = (req.query.search as string) || ''

    const response = await getDashboardLetters(user, page, limit, search)
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}

export const processDecision: RequestHandler = async (req, res: Response, next: NextFunction) => {
  try {
    const user = (req as UserRequest).user! as UserWithRelations
    const letterId = req.params.letterId

    // Validasi format UUID
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(letterId)) {
      res.status(400).send({ errors: 'Invalid UUID format for Letter Id' })
      return
    }

    const request: ProcessDecisionRequestDto = req.body
    const response = await processDecisionLetter(letterId, request, user)
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}

export const getProcurementLetterFile: RequestHandler = async (req, res, next) => {
  try {
    const { fileName } = req.params
    const filePath = await getProcurementLetterPath(fileName)
    res.sendFile(filePath)
  } catch (e) {
    next(e)
  }
}
