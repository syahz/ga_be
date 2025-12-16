import { Validation } from '../validation/Validation'
import { prismaClient } from '../application/database'
import { ResponseError } from '../error/response-error'
import { UserValidation } from '../validation/user-validation'
import { UserResponse, toUserResponse, UpdateAccountUserRequest } from '../models/user-model'

// Service for get user details
export const getUser = async (userId: string): Promise<UserResponse> => {
  const result = await prismaClient.user.findFirst({
    where: {
      id: userId
    }
  })

  if (!result) {
    throw new ResponseError(404, 'User tidak ditemukan')
  }

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
