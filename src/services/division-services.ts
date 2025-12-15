import { Validation } from '../validation/Validation'
import { prismaClient } from '../application/database'
import { ResponseError } from '../error/response-error'
import { DivisionValidation } from '../validation/division-validation'
import { toAllDivisionsResponse, toDivisionResponse, DivisionResponse, CreateDivisionRequest, UpdateDivisionRequest } from '../models/division-model'

/**
 * Service untuk membuat division baru.
 */
export const createDivision = async (request: CreateDivisionRequest): Promise<DivisionResponse> => {
  const createRequest = Validation.validate(DivisionValidation.CREATE, request)

  // Cek duplikasi nama division (case-insensitive)
  const existingDivision = await prismaClient.division.findFirst({
    where: { name: { equals: createRequest.name } }
  })
  if (existingDivision) {
    throw new ResponseError(409, 'Nama division sudah ada')
  }

  const newDivision = await prismaClient.division.create({ data: createRequest })
  return toDivisionResponse(newDivision)
}

/**
 * Service untuk mendapatkan daftar semua divisi yang digunakan untuk select di Frontend.
 */
export const getAllDivisions = async () => {
  const divisions = await prismaClient.division.findMany({ orderBy: { name: 'asc' } })

  return divisions.map(toDivisionResponse)
}
/**
 * Service untuk mendapatkan daftar semua division dengan paginasi dan pencarian.
 */
export const getDivisions = async (page: number, limit: number, search: string) => {
  const skip = (page - 1) * limit
  const where = search ? { name: { contains: search } } : {}

  const [total, divisions] = await prismaClient.$transaction([
    prismaClient.division.count({ where }),
    prismaClient.division.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } })
  ])

  return toAllDivisionsResponse(divisions, total, page, limit)
}

/**
 * Service untuk mendapatkan detail satu division berdasarkan ID.
 */
export const getDivisionById = async (divisionId: string): Promise<DivisionResponse> => {
  const division = await prismaClient.division.findUnique({ where: { id: divisionId } })
  if (!division) {
    throw new ResponseError(404, 'Division tidak ditemukan')
  }
  return toDivisionResponse(division)
}

/**
 * Service untuk mengupdate division berdasarkan ID.
 */
export const updateDivision = async (divisionId: string, request: UpdateDivisionRequest): Promise<DivisionResponse> => {
  const updateRequest = Validation.validate(DivisionValidation.UPDATE, request)

  // Cek apakah division yang akan diupdate ada
  const existingDivision = await prismaClient.division.findUnique({ where: { id: divisionId } })
  if (!existingDivision) {
    throw new ResponseError(404, 'Division tidak ditemukan')
  }

  // Cek duplikasi jika nama diubah
  if (updateRequest.name) {
    const conflictingDivision = await prismaClient.division.findFirst({
      where: {
        AND: [{ id: { not: divisionId } }, { name: { equals: updateRequest.name } }]
      }
    })
    if (conflictingDivision) {
      throw new ResponseError(409, 'Nama division sudah digunakan oleh division lain')
    }
  }

  const updatedDivision = await prismaClient.division.update({
    where: { id: divisionId },
    data: updateRequest
  })

  return toDivisionResponse(updatedDivision)
}

/**
 * Service untuk menghapus division berdasarkan ID.
 */
export const deleteDivision = async (divisionId: string): Promise<{ message: string }> => {
  // Cek apakah division ada
  const division = await prismaClient.division.findUnique({ where: { id: divisionId } })
  if (!division) {
    throw new ResponseError(404, 'Division tidak ditemukan')
  }

  // Cek apakah division masih terhubung dengan user
  const userCount = await prismaClient.user.count({ where: { divisionId: divisionId } })
  if (userCount > 0) {
    throw new ResponseError(400, `Division tidak dapat dihapus karena masih terhubung dengan ${userCount} user.`)
  }

  await prismaClient.division.delete({ where: { id: divisionId } })
  return { message: 'Division berhasil dihapus' }
}
