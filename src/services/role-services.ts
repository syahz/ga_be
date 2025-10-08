import { Validation } from '../validation/Validation'
import { prismaClient } from '../application/database'
import { ResponseError } from '../error/response-error'
import { RoleValidation } from '../validation/role-validation'
import { toAllRolesResponse, toRoleResponse, RoleResponse, CreateRoleRequest, UpdateRoleRequest } from '../models/role-model'

/**
 * Service untuk membuat role baru.
 */
export const createRole = async (request: CreateRoleRequest): Promise<RoleResponse> => {
  const createRequest = Validation.validate(RoleValidation.CREATE, request)

  // Cek duplikasi nama role (case-insensitive)
  const existingRole = await prismaClient.role.findFirst({
    where: { name: { equals: createRequest.name } }
  })
  if (existingRole) {
    throw new ResponseError(409, 'Nama role sudah ada')
  }

  const newRole = await prismaClient.role.create({ data: createRequest })
  return toRoleResponse(newRole)
}

/**
 * Service untuk mendapatkan daftar semua role yang digunakan untuk select di Frontend.
 */
export const getAllRoles = async () => {
  const roles = await prismaClient.role.findMany({ orderBy: { name: 'asc' } })

  return roles.map(toRoleResponse)
}
/**
 * Service untuk mendapatkan daftar semua role dengan paginasi dan pencarian.
 */
export const getRoles = async (page: number, limit: number, search: string) => {
  const skip = (page - 1) * limit
  const where = search ? { name: { contains: search } } : {}

  const [total, roles] = await prismaClient.$transaction([
    prismaClient.role.count({ where }),
    prismaClient.role.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } })
  ])

  return toAllRolesResponse(roles, total, page, limit)
}

/**
 * Service untuk mendapatkan detail satu role berdasarkan ID.
 */
export const getRoleById = async (roleId: string): Promise<RoleResponse> => {
  const role = await prismaClient.role.findUnique({ where: { id: roleId } })
  if (!role) {
    throw new ResponseError(404, 'Role tidak ditemukan')
  }
  return toRoleResponse(role)
}

/**
 * Service untuk mengupdate role berdasarkan ID.
 */
export const updateRole = async (roleId: string, request: UpdateRoleRequest): Promise<RoleResponse> => {
  const updateRequest = Validation.validate(RoleValidation.UPDATE, request)

  // Cek apakah role yang akan diupdate ada
  const existingRole = await prismaClient.role.findUnique({ where: { id: roleId } })
  if (!existingRole) {
    throw new ResponseError(404, 'Role tidak ditemukan')
  }

  // Cek duplikasi jika nama diubah
  if (updateRequest.name) {
    const conflictingRole = await prismaClient.role.findFirst({
      where: {
        AND: [{ id: { not: roleId } }, { name: { equals: updateRequest.name } }]
      }
    })
    if (conflictingRole) {
      throw new ResponseError(409, 'Nama role sudah digunakan oleh role lain')
    }
  }

  const updatedRole = await prismaClient.role.update({
    where: { id: roleId },
    data: updateRequest
  })

  return toRoleResponse(updatedRole)
}

/**
 * Service untuk menghapus role berdasarkan ID.
 */
export const deleteRole = async (roleId: string): Promise<{ message: string }> => {
  // Cek apakah role ada
  const role = await prismaClient.role.findUnique({ where: { id: roleId } })
  if (!role) {
    throw new ResponseError(404, 'Role tidak ditemukan')
  }

  // Cek apakah role masih terhubung dengan user
  const userCount = await prismaClient.user.count({ where: { roleId: roleId } })
  if (userCount > 0) {
    throw new ResponseError(400, `Role tidak dapat dihapus karena masih terhubung dengan ${userCount} user.`)
  }

  await prismaClient.role.delete({ where: { id: roleId } })
  return { message: 'Role berhasil dihapus' }
}
