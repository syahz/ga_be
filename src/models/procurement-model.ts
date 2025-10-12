import { ProcurementLetter, User, Unit } from '@prisma/client'

// DTO untuk membuat surat (unitId dibuat opsional)
export interface CreateProcurementRequestDto {
  letterNumber: string
  letterAbout: string
  nominal: number
  incomingLetterDate: string
  letterFile: string
  unitId: string
}

// DTO untuk memproses keputusan (tidak berubah)
export interface ProcessDecisionRequestDto {
  decision: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION'
  comment?: string
}

// Tipe data dasar dengan relasi (tidak perlu diekspor)
type ProcurementLetterWithRelations = ProcurementLetter & {
  createdBy: Pick<User, 'name'> | null
  currentApprover?: Pick<User, 'name'> | null
  unit: Pick<Unit, 'name'> | null
}

// Tipe data final untuk SATU surat yang akan dikirim sebagai response (nominal sudah string)
export type ProcurementLetterResponse = Omit<ProcurementLetterWithRelations, 'nominal'> & {
  nominal: string
}

// Tipe data untuk response get all data dengan paginasi
export type GetAllProcurementLettersResponse = {
  letters: ProcurementLetterResponse[]
  pagination: {
    total_data: number
    page: number
    limit: number
    total_page: number
  }
}

// Fungsi helper serialisasi BigInt
function serializeBigInt(obj: any) {
  return JSON.parse(JSON.stringify(obj, (_, value) => (typeof value === 'bigint' ? value.toString() : value)))
}

/**
 * Helper function untuk mengubah SATU objek surat dari Prisma
 * menjadi format JSON response yang aman (menangani BigInt dan relasi null).
 */
export function toProcurementLetterResponse(letter: ProcurementLetterWithRelations): ProcurementLetterResponse {
  const serialized = serializeBigInt(letter)
  return {
    ...serialized,
    createdBy: letter.createdBy || { name: 'Unknown User' },
    currentApprover: letter.currentApprover, // Bisa null, jadi tidak perlu fallback
    unit: letter.unit || { name: 'Unknown Unit' }
  }
}

/**
 * Helper function untuk mengubah hasil query (banyak surat)
 * menjadi format response yang kita inginkan, lengkap dengan paginasi.
 */
export function toAllProcurementLettersResponse(
  letters: ProcurementLetterWithRelations[],
  total: number,
  page: number,
  limit: number
): GetAllProcurementLettersResponse {
  return {
    letters: letters.map(toProcurementLetterResponse), // Menggunakan helper tunggal untuk konsistensi
    pagination: {
      total_data: total,
      page: page,
      limit: limit,
      total_page: Math.ceil(total / limit)
    }
  }
}
