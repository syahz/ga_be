import { NextFunction, Request, Response } from 'express'
import { CreateParticipantUserRequest, UpdateParticipantUserRequest } from '../models/participant-model'
import { createParticipant, getParticipantById, getParticipants, updateParticipant, deleteParticipant } from '../services/participant-services'

export const root = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({
      data: 'OK'
    })
  } catch (e) {
    next(e)
  }
}

/**
 * Controller untuk mendapatkan daftar semua participant.
 * Menerima query params: page, limit, search, roleId, unitId.
 */
export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parsing query parameters dengan nilai default
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const search = (req.query.search as string) || ''

    // Parsing filter opsional
    const roleId = (req.query.roleId as string) || undefined
    const unitId = (req.query.unitId as string) || undefined

    const response = await getParticipants(page, limit, search, roleId, unitId)

    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

/**
 * Controller untuk mendapatkan detail participant.
 * Menerima parameter: participantId.
 */
export const details = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const participantId = String(req.params.participantId)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(participantId)) {
      return res.status(400).send({ errors: 'Invalid UUID format for Participant Id' })
    }

    const response = await getParticipantById(participantId)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

/**
 * Controller untuk mengupdate participant data.
 * Menerima parameter: participantId.
 */
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const participantId = String(req.params.participantId)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    const request: UpdateParticipantUserRequest = req.body as UpdateParticipantUserRequest

    if (!uuidRegex.test(participantId)) {
      return res.status(400).send({ errors: 'Invalid UUID format for Participant Id' })
    }

    const response = await updateParticipant(participantId, request)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

/**
 * Controller untuk Menambah participant data.
 * Menerima request body sesuai CreateParticipantUserRequest.
 */
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request: CreateParticipantUserRequest = req.body as CreateParticipantUserRequest
    const response = await createParticipant(request)
    res.status(201).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

/**
 * Controller untuk menghapus participant data.
 * Menerima parameter participantId.
 */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const participantId = String(req.params.participantId)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!uuidRegex.test(participantId)) {
      return res.status(400).send({ errors: 'Invalid UUID format for Participant Id' })
    }
    const response = await deleteParticipant(participantId)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}
