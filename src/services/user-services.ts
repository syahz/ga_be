import bcrypt from 'bcrypt'
import { Validation } from '../validation/Validation'
import { prismaClient } from '../application/database'
import { ResponseError } from '../error/response-error'
import { UserValidation } from '../validation/user-validation'
import { UserRole, UserResponse, toUserResponse, UpdateAccountUserRequest, UpdateAccountPasswordRequest } from '../models/user-model'

// Service for get user details
export const getUser = async (userId: string, role: UserRole): Promise<UserResponse> => {
  const result = await prismaClient.user.findFirst({
    where: {
      id: userId
    }
  })

  if (!result) {
    throw new ResponseError(404, 'User tidak ditemukan')
  }

  // Mapper tetap sama, ia akan menangani kedua kasus (dengan atau tanpa auditor)
  return toUserResponse(result)
}

// Service for update user account
export const updateUser = async (userId: string, data: UpdateAccountUserRequest) => {
  const updateAccountUserRequest = Validation.validate(UserValidation.UPDATEACCOUNT, data)

  const user = await prismaClient.user.findUnique({
    where: {
      id: userId
    }
  })
  if (!user) {
    throw new ResponseError(404, 'User tidak ditemukan')
  }

  await prismaClient.user.update({
    where: {
      id: userId
    },
    data: {
      name: updateAccountUserRequest.name,
      email: updateAccountUserRequest.email
    }
  })

  return {
    message: 'Akun berhasil diperbarui.'
  }
}

// Service for update user password
export const updatePassword = async (userId: string, data: UpdateAccountPasswordRequest) => {
  const { current_password, new_password } = Validation.validate(UserValidation.UPDATEPASSWORD, data)

  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { password: true }
  })

  if (!user) {
    throw new ResponseError(404, 'User tidak ditemukan')
  }

  const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password)
  if (!isCurrentPasswordValid) {
    throw new ResponseError(400, 'Password saat ini tidak valid')
  }

  const isNewPasswordSameAsOld = await bcrypt.compare(new_password, user.password)
  if (isNewPasswordSameAsOld) {
    throw new ResponseError(400, 'Password baru tidak boleh sama dengan password lama')
  }

  const hashedNewPassword = await bcrypt.hash(new_password, 10)

  await prismaClient.user.update({
    where: { id: userId },
    data: { password: hashedNewPassword }
  })

  return {
    message: 'Password berhasil diperbarui.'
  }
}
