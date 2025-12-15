import { Division } from '@prisma/client'

// DTO untuk membuat divisi baru
export interface CreateDivisionRequest {
  name: string
}

// DTO untuk mengupdate divisi
export interface UpdateDivisionRequest {
  name?: string
}

// Tipe data final yang akan dikirim sebagai response untuk satu divisi
export type DivisionResponse = {
  id: string
  name: string
}

// Tipe data untuk response get all, termasuk paginasi
export type GetAllDivisionsResponse = {
  divisions: DivisionResponse[]
  pagination: {
    total_data: number
    page: number
    limit: number
    total_page: number
  }
}

/**
 * Helper function (mapper) untuk mengubah satu objek Division dari Prisma
 */
export function toDivisionResponse(division: Division): DivisionResponse {
  return {
    id: division.id,
    name: division.name
  }
}

/**
 * Helper function (mapper) untuk mengubah hasil query (banyak divisi)
 */
export function toAllDivisionsResponse(divisions: Division[], total: number, page: number, limit: number): GetAllDivisionsResponse {
  return {
    divisions: divisions.map((division) => toDivisionResponse(division)),
    pagination: {
      total_data: total,
      page: page,
      limit: limit,
      total_page: Math.ceil(total / limit)
    }
  }
}
