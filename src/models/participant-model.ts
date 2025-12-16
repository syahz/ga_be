import { User, Role, Unit, Division } from '@prisma/client'

// Request and Response for Participant User
export type CreateParticipantUserRequest = {
  name: string
  email: string
  password: string
  roleId: string
  unitId: string
  divisionId: string
  confirmPassword: string
}

export type UpdateParticipantUserRequest = {
  name?: string
  email?: string
  roleId?: string
  unitId?: string
  divisionId?: string
}

// Tipe data final yang akan dikirim sebagai response untuk setiap user
// Ini adalah gabungan dari data User, Role, dan Unit
export type ParticipantUserResponse = {
  id: string
  name: string
  email: string
  role: {
    id: string
    name: string
  } | null // Role bisa null jika ada data yang tidak konsisten
  unit: {
    id: string
    name: string
  } | null // Unit juga bisa null
  division: {
    id: string
    name: string
  } | null // Division juga bisa null
}

// Tipe data untuk membungkus keseluruhan response, termasuk paginasi
export type GetAllParticipantsResponse = {
  users: ParticipantUserResponse[]
  pagination: {
    total_data: number
    page: number
    limit: number
    total_page: number
  }
}

// Tipe data yang diterima dari Prisma (User dengan relasi Role dan Unit)
type UserWithRoleAndUnit = User & {
  role: Role | null
  unit: Unit | null
  division: Division | null
}

/**
 * Helper function (mapper) untuk mengubah hasil query Prisma
 * menjadi format JSON response yang kita inginkan.
 * @param users - Array user dari hasil query prismaClient.user.findMany
 * @param total - Jumlah total user dari query prismaClient.user.count
 * @param page - Halaman saat ini
 * @param limit - Batas data per halaman
 */
export function toAllParticipantsResponse(users: UserWithRoleAndUnit[], total: number, page: number, limit: number): GetAllParticipantsResponse {
  return {
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      // Melakukan mapping data relasi dengan aman
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name
          }
        : null,
      unit: user.unit
        ? {
            id: user.unit.id,
            name: user.unit.name
          }
        : null,
      division: user.division
        ? {
            id: user.division.id,
            name: user.division.name
          }
        : null
    })),
    pagination: {
      total_data: total,
      page: page,
      limit: limit,
      total_page: Math.ceil(total / limit)
    }
  }
}

export function toParticipantResponse(user: UserWithRoleAndUnit): ParticipantUserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
      ? {
          id: user.role.id,
          name: user.role.name
        }
      : null,
    unit: user.unit
      ? {
          id: user.unit.id,
          name: user.unit.name
        }
      : null,
    division: user.division
      ? {
          id: user.division.id,
          name: user.division.name
        }
      : null
  }
}
