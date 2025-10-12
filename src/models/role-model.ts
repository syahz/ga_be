import { Role } from '@prisma/client'

// DTO untuk membuat role baru
export interface CreateRoleRequest {
  name: string
}

// DTO untuk mengupdate role
export interface UpdateRoleRequest {
  name?: string
}

// Tipe data final yang akan dikirim sebagai response untuk satu role
export type RoleResponse = {
  id: string
  name: string
}

// Tipe data untuk response get all, termasuk paginasi
export type GetAllRolesResponse = {
  roles: RoleResponse[]
  pagination: {
    total_data: number
    page: number
    limit: number
    total_page: number
  }
}

/**
 * Helper function (mapper) untuk mengubah satu objek Role dari Prisma
 * menjadi format JSON response yang kita inginkan.
 */
export function toRoleResponse(role: Role): RoleResponse {
  return {
    id: role.id,
    name: role.name
  }
}

/**
 * Helper function (mapper) untuk mengubah hasil query (banyak role)
 * menjadi format response yang kita inginkan, lengkap dengan paginasi.
 */
export function toAllRolesResponse(roles: Role[], total: number, page: number, limit: number): GetAllRolesResponse {
  return {
    roles: roles.map((role) => toRoleResponse(role)),
    pagination: {
      total_data: total,
      page: page,
      limit: limit,
      total_page: Math.ceil(total / limit)
    }
  }
}
