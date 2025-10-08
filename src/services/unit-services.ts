import { Validation } from '../validation/Validation'
import { prismaClient } from '../application/database'
import { ResponseError } from '../error/response-error'
import { UnitValidation } from '../validation/unit-validation'
import { toAllUnitsResponse, toUnitResponse, UnitResponse, CreateUnitRequest, UpdateUnitRequest } from '../models/unit-model'

/**
 * Service untuk membuat unit baru.
 */
export const createUnit = async (request: CreateUnitRequest): Promise<UnitResponse> => {
  const createRequest = Validation.validate(UnitValidation.CREATE, request)

  // Cek duplikasi kode atau nama
  const existingUnit = await prismaClient.unit.findFirst({
    where: { OR: [{ code: createRequest.code }, { name: createRequest.name }] }
  })
  if (existingUnit) {
    throw new ResponseError(409, 'Kode atau Nama unit sudah ada')
  }

  const newUnit = await prismaClient.unit.create({ data: createRequest })
  return toUnitResponse(newUnit)
}

/**
 * Service untuk mendapatkan daftar semua unit yang digunakan untuk select di Frontend.
 */
export const getAllUnits = async () => {
  const units = await prismaClient.unit.findMany({ orderBy: { name: 'asc' } })

  return units.map(toUnitResponse)
}

/**
 * Service untuk mendapatkan daftar semua unit dengan paginasi dan pencarian.
 */
export const getUnits = async (page: number, limit: number, search: string) => {
  const skip = (page - 1) * limit
  const where = search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}

  const [total, units] = await prismaClient.$transaction([
    prismaClient.unit.count({ where }),
    prismaClient.unit.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } })
  ])

  return toAllUnitsResponse(units, total, page, limit)
}

/**
 * Service untuk mendapatkan detail satu unit berdasarkan ID.
 */
export const getUnitById = async (unitId: string): Promise<UnitResponse> => {
  const unit = await prismaClient.unit.findUnique({ where: { id: unitId } })
  if (!unit) {
    throw new ResponseError(404, 'Unit tidak ditemukan')
  }
  return toUnitResponse(unit)
}

/**
 * Service untuk mengupdate unit berdasarkan ID.
 */
export const updateUnit = async (unitId: string, request: UpdateUnitRequest): Promise<UnitResponse> => {
  const updateRequest = Validation.validate(UnitValidation.UPDATE, request)

  // Cek apakah unit yang akan diupdate ada
  const existingUnit = await prismaClient.unit.findUnique({ where: { id: unitId } })
  if (!existingUnit) {
    throw new ResponseError(404, 'Unit tidak ditemukan')
  }

  // Cek duplikasi jika kode atau nama diubah
  if (updateRequest.code || updateRequest.name) {
    const conflictingUnit = await prismaClient.unit.findFirst({
      where: {
        AND: [
          { id: { not: unitId } }, // Bukan unit yang sedang diupdate
          { OR: [{ code: updateRequest.code }, { name: updateRequest.name }] }
        ]
      }
    })
    if (conflictingUnit) {
      throw new ResponseError(409, 'Kode atau Nama unit sudah digunakan oleh unit lain')
    }
  }

  const updatedUnit = await prismaClient.unit.update({
    where: { id: unitId },
    data: updateRequest
  })

  return toUnitResponse(updatedUnit)
}

/**
 * Service untuk menghapus unit berdasarkan ID.
 */
export const deleteUnit = async (unitId: string): Promise<{ message: string }> => {
  // Cek apakah unit ada
  const unit = await prismaClient.unit.findUnique({ where: { id: unitId } })
  if (!unit) {
    throw new ResponseError(404, 'Unit tidak ditemukan')
  }

  // Cek apakah unit masih terhubung dengan user
  const userCount = await prismaClient.user.count({ where: { unitId: unitId } })
  if (userCount > 0) {
    throw new ResponseError(400, `Unit tidak dapat dihapus karena masih terhubung dengan ${userCount} user.`)
  }

  await prismaClient.unit.delete({ where: { id: unitId } })
  return { message: 'Unit berhasil dihapus' }
}
