import {
  getHistoryLogs,
  getDashboardUser,
  getProcurementLetters,
  getProcurementDetails,
  processDecisionLetter,
  getProcurementProgress,
  updateProcurementLetter,
  createProcurementLetter,
  getProcurementLetterPath
} from '../services/procurement-services'
import { ResponseError } from '../error/response-error'
import { NextFunction, Response, Request, RequestHandler } from 'express'
import { UserRequest, UserWithRelations } from '../type/user-request'
import { CreateProcurementRequestDto, ProcessDecisionRequestDto, UpdateProcurementRequestDto } from '../models/procurement-model'

//Controller untuk mendapatkan dashboard user (GET)
export const getDashboard: RequestHandler = async (req, res: Response, next: NextFunction) => {
  try {
    const user = (req as UserRequest).user! as UserWithRelations
    const response = await getDashboardUser(user)
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}

// Controller untuk mendapatkan surat masuk pengadaan (GET)
export const getProcurements: RequestHandler = async (req, res: Response, next: NextFunction) => {
  try {
    const user = (req as UserRequest).user! as UserWithRelations

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const search = (req.query.search as string) || ''

    const response = await getProcurementLetters(user, page, limit, search)
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}

// Controller untuk mendapatkan detail surat pengadaan untuk satu surat tertentu (GET DETAILS)
export const getDetails: RequestHandler = async (req, res: Response, next: NextFunction) => {
  try {
    const user = (req as UserRequest).user! as UserWithRelations
    const letterId = req.params.letterId
    const response = await getProcurementDetails(user, letterId)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

// Controller untuk mendapatkan dashboard riwayat surat pengadaan (GET HISTORY)
export const getHistoryProcurements: RequestHandler = async (req, res: Response, next: NextFunction) => {
  try {
    const user = (req as UserRequest).user! as UserWithRelations

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const search = (req.query.search as string) || ''

    // Panggil service yang baru
    const response = await getHistoryLogs(user, page, limit, search)
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}

// Controller untuk membuat surat pengadaan (POST)
export const create: RequestHandler = async (req, res: Response, next: NextFunction) => {
  try {
    const user = (req as UserRequest).user! as UserWithRelations
    const request: CreateProcurementRequestDto = req.body as CreateProcurementRequestDto

    if (!req.file) {
      throw new ResponseError(400, 'File surat (letterFile) wajib diunggah.')
    }

    request.letterFile = req.file.filename
    const response = await createProcurementLetter(request, user)
    res.status(201).json({ data: response })
  } catch (e) {
    next(e)
  }
}

// Controller untuk memproses keputusan pada surat pengadaan (POST PROCESS DECISION)
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

// Controller untuk mendapatkan file surat pengadaan (GET FILE)
export const getProcurementLetterFile: RequestHandler = async (req, res, next) => {
  try {
    const { fileName } = req.params
    const filePath = await getProcurementLetterPath(fileName)
    res.sendFile(filePath)
  } catch (e) {
    next(e)
  }
}

// Controller untuk mengubah surat pengadaan (PUT)
export const update: RequestHandler = async (req, res: Response, next: NextFunction) => {
  try {
    const user = (req as UserRequest).user! as UserWithRelations
    const { letterId } = req.params
    const request: UpdateProcurementRequestDto = req.body as UpdateProcurementRequestDto

    if (req.file) {
      request.letterFile = req.file.filename
    }

    const response = await updateProcurementLetter(letterId, request, user)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

// Controller Untuk Mendapatkan Detail Surat beserta Log-nya (GET DETAILS WITH LOGS)
export const getProgress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const letterId = req.params.letterId
    const response = await getProcurementProgress(letterId)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}
