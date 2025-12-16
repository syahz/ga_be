import { User, Unit, Role } from '@prisma/client'

export type UserPayload = {
  id: string
  unit: Unit
  role: {
    id: string
    name: string
  }
  division: {
    id: string
    name: string
  }
}

// For Account User
export type UpdateAccountUserRequest = {
  name?: string
  email?: string
}

export type UserResponse = {
  id: string
  name: string
  email: string
}

export const toUserResponse = (user: User): UserResponse => {
  // Buat objek dasar
  const response: UserResponse = {
    id: user.id,
    name: user.name,
    email: user.email
  }

  return response
}
