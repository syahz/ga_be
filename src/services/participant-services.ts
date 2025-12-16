import {
  toParticipantResponse,
  ParticipantUserResponse,
  toAllParticipantsResponse,
  UpdateParticipantUserRequest,
  CreateParticipantUserRequest
} from '../models/participant-model'
import bcrypt from 'bcrypt'
import { Validation } from '../validation/Validation'
import { prismaClient } from '../application/database'
import { ResponseError } from '../error/response-error'
import { toUserResponse, UserResponse } from '../models/user-model'
import { ParticipantValidation } from '../validation/participant-validation'

export const getParticipants = async (page: number, limit: number, search: string, roleId?: string, unitId?: string) => {
  const skip = (page - 1) * limit

  const filters = []

  // Filter 1: Pencarian berdasarkan nama atau email
  if (search) {
    filters.push({
      OR: [{ name: { contains: search } }, { email: { contains: search } }]
    })
  }

  // Filter 2: Berdasarkan Role
  if (roleId) {
    filters.push({
      roleId: roleId
    })
  }

  // Filter 3: Berdasarkan Unit
  if (unitId) {
    filters.push({
      unitId: unitId
    })
  }

  // Menggabungkan semua filter dengan operator AND
  const where = filters.length > 0 ? { AND: filters } : {}

  const [total, users] = await prismaClient.$transaction([
    prismaClient.user.count({ where }),
    prismaClient.user.findMany({
      where,
      skip,
      take: limit,
      include: {
        role: true,
        unit: true,
        division: true
      },
      orderBy: { name: 'asc' }
    })
  ])

  // Gunakan helper dari model untuk memformat respons akhir
  return toAllParticipantsResponse(users, total, page, limit)
}

export const getParticipantById = async (participantId: string): Promise<ParticipantUserResponse> => {
  const result = await prismaClient.user.findFirst({
    where: {
      id: participantId
    },
    include: {
      role: true,
      unit: true,
      division: true
    },
    orderBy: { id: 'asc' }
  })

  if (!result) {
    throw new ResponseError(404, 'Participant User tidak ditemukan')
  }

  return toParticipantResponse(result)
}

export const updateParticipant = async (participantId: string, request: UpdateParticipantUserRequest): Promise<ParticipantUserResponse> => {
  const updateRequest = Validation.validate(ParticipantValidation.UPDATE, request)

  const participant = await prismaClient.user.findUnique({
    where: { id: participantId }
  })
  if (!participant) {
    throw new ResponseError(404, 'Participant tidak ditemukan')
  }

  if (updateRequest.email && updateRequest.email !== participant.email) {
    const existingUserWithEmail = await prismaClient.user.findUnique({
      where: { email: updateRequest.email }
    })
    if (existingUserWithEmail) {
      throw new ResponseError(409, 'Email sudah digunakan oleh user lain')
    }
  }

  if (updateRequest.roleId) {
    const role = await prismaClient.role.findUnique({
      where: { id: updateRequest.roleId }
    })
    if (!role) {
      throw new ResponseError(400, 'Id Role tidak valid atau tidak ditemukan')
    }
  }

  if (updateRequest.unitId) {
    const unit = await prismaClient.unit.findUnique({
      where: { id: updateRequest.unitId }
    })
    if (!unit) {
      throw new ResponseError(400, 'Id Unit tidak valid atau tidak ditemukan')
    }
  }
  if (updateRequest.divisionId) {
    const division = await prismaClient.division.findUnique({
      where: { id: updateRequest.divisionId }
    })
    if (!division) {
      throw new ResponseError(400, 'Id Divisi tidak valid atau tidak ditemukan')
    }
  }

  const dataToUpdate: any = {}
  if (updateRequest.name) dataToUpdate.name = updateRequest.name
  if (updateRequest.email) dataToUpdate.email = updateRequest.email
  if (updateRequest.roleId) dataToUpdate.roleId = updateRequest.roleId
  if (updateRequest.unitId) dataToUpdate.unitId = updateRequest.unitId
  if (updateRequest.divisionId) dataToUpdate.divisionId = updateRequest.divisionId

  const updatedUser = await prismaClient.user.update({
    where: { id: participantId },
    data: dataToUpdate,
    include: {
      role: true,
      unit: true,
      division: true
    }
  })

  return toParticipantResponse(updatedUser)
}

export const createParticipant = async (request: CreateParticipantUserRequest): Promise<UserResponse> => {
  // Validasi input
  const createRequest = Validation.validate(ParticipantValidation.CREATE, request)

  // Cek apakah email sudah dipakai
  const existing = await prismaClient.user.findUnique({
    where: { email: createRequest.email }
  })
  if (existing) {
    throw new ResponseError(400, 'Email sudah terdaftar')
  }

  // Cek RoleId dan UnitId apakah ada di tabel masing-masing
  const role = await prismaClient.role.findMany().then((roles) => roles.find((r) => r.id === createRequest.roleId))
  if (!role) {
    throw new ResponseError(500, 'Id Role belum tersedia, jalankan seeder')
  }

  const unit = await prismaClient.unit.findUnique({ where: { id: createRequest.unitId } })
  if (!unit) {
    throw new ResponseError(500, 'Id Unit belum tersedia, jalankan seeder')
  }

  const division = await prismaClient.division.findUnique({ where: { id: createRequest.divisionId } })
  if (!division) {
    throw new ResponseError(500, 'Id Divisi belum tersedia, jalankan seeder')
  }

  // Simpan ke DB
  const user = await prismaClient.user.create({
    data: {
      name: createRequest.name,
      email: createRequest.email,
      roleId: role.id,
      unitId: createRequest.unitId,
      divisionId: createRequest.divisionId
    }
  })

  return toUserResponse(user)
}

export const deleteParticipant = async (participantId: string): Promise<ParticipantUserResponse> => {
  // Cek Is Participant Existing or no
  const user = await prismaClient.user.findFirst({
    where: {
      id: participantId
    },
    include: {
      role: true,
      unit: true,
      division: true
    }
  })
  if (!user) {
    throw new ResponseError(404, 'User tidak ditemukan')
  }

  await prismaClient.user.delete({
    where: { id: participantId }
  })

  return toParticipantResponse(user)
}
