import { ProcurementLetter, User, Unit } from '@prisma/client'

// DTO untuk membuat surat (tidak berubah)
export interface CreateProcurementRequestDto {
  letterNumber: string
  letterAbout: string
  nominal: number
  incomingLetterDate: string
  letterFile?: string
}

// DTO untuk memproses keputusan (tidak berubah)
export interface ProcessDecisionRequestDto {
  decision: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION'
  comment?: string
}

// Tipe data detail surat (tidak berubah)
export type ProcurementLetterWithDetails = ProcurementLetter & {
  createdBy: Pick<User, 'name'>
  currentApprover?: Pick<User, 'name'> | null
  unit: Pick<Unit, 'name'>
}

// --- PERUBAHAN DIMULAI DI SINI ---

// Model Type untuk response get all data dengan paginasi
export type GetAllProcurementLettersResponse = {
  letters: ProcurementLetterWithDetails[]
  pagination: {
    total_data: number
    page: number
    limit: number
    total_page: number
  }
}

// Helper function untuk memetakan hasil query ke response yang diinginkan
export function toAllProcurementLettersResponse(
  letters: (ProcurementLetter & {
    createdBy: { name: string } | null
    currentApprover: { name: string } | null
    unit: { name: string } | null
  })[],
  total: number,
  page: number,
  limit: number
): GetAllProcurementLettersResponse {
  return {
    letters: letters.map((letter) => ({
      ...serializeBigInt(letter), // Mengubah BigInt ke string jika ada
      // Memastikan relasi tidak null untuk konsistensi
      createdBy: letter.createdBy || { name: 'Unknown User' },
      unit: letter.unit || { name: 'Unknown Unit' }
    })),
    pagination: {
      total_data: total,
      page: page,
      limit: limit,
      total_page: Math.ceil(total / limit)
    }
  }
}

function serializeBigInt(obj: any) {
  return JSON.parse(JSON.stringify(obj, (_, value) => (typeof value === 'bigint' ? value.toString() : value)))
}
