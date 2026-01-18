import { ProcurementLetter, User, Unit, ProcurementLog, LogAction } from '@prisma/client'

export enum ProcessDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  REQUEST_REVISION = 'REQUEST_REVISION'
}

// --------- MODEL & TYPE DEFINITIONS UNTUK PROCUREMENT LETTERS --------- //
// Type data form untuk create dan update
interface ProcurementFormData {
  letterNumber: string
  letterAbout: string
  nominal: number
  incomingLetterDate: string
  unitId: string
  letterFile?: string
  note?: string
}

export type ProcurementLogFormData = Omit<ProcurementLog, 'id' | 'procurementLetterId' | 'timestamp'> & {
  logId: string
  action: LogAction
  comment?: string | null
  timestamp: string
  actor: Pick<User, 'id' | 'name'>
}

export type LatestNoteResponse = {
  logId: string
  action: LogAction
  comment: string | null
  timestamp: string
  actor: Pick<User, 'id' | 'name'>
}

// DTO untuk membuat surat
export type CreateProcurementRequestDto = ProcurementFormData
// DTO untuk mengubah surat
export type UpdateProcurementRequestDto = Omit<ProcurementFormData, 'letterFile'> & {
  letterFile?: string
}

// DTO untuk memproses keputusan
export interface ProcessDecisionRequestDto {
  decision: ProcessDecision
  comment?: string
}

// Tipe data dasar dengan relasi
type ProcurementLetterWithRelations = ProcurementLetter & {
  createdBy: Pick<User, 'name'> | null
  currentApprover?: Pick<User, 'name'> | null
  unit: Pick<Unit, 'name'> | null
}

// Tipe data final untuk SATU surat yang akan dikirim sebagai response (nominal sudah string)
export type ProcurementLetterResponse = Omit<ProcurementLetterWithRelations, 'nominal'> & {
  nominal: string
  latestNote?: LatestNoteResponse
}

export type ProgressResponse = {
  letter: ProcurementLetterResponse
  logs: ProcurementLogFormData[]
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

export type DashboardSummary = {
  total_in_unit: number
  total_approved: number
  total_rejected: number
}

export type GetDashboardProcurementsResponse = {
  summary: DashboardSummary
  letters: ProcurementLetterResponse[]
  pagination: {
    total_data: number
    page: number
    limit: number
    total_page: number
  }
}
/**
 * Helper function untuk mengubah SATU objek surat dari Prisma
 * menjadi format JSON response yang aman (menangani BigInt dan relasi null).
 */
export function toProcurementLetterResponse(letter: ProcurementLetterWithRelations, latestNote?: LatestNoteResponse): ProcurementLetterResponse {
  const serialized = serializeBigInt(letter)
  return {
    ...serialized,
    createdBy: letter.createdBy || { name: 'Unknown User' },
    currentApprover: letter.currentApprover || { name: 'Unknown Approver' },
    unit: letter.unit || { name: 'Unknown Unit' },
    ...(latestNote ? { latestNote } : {})
  }
}

/**
 * Helper function untuk mengubah hasil query (banyak surat)
 * menjadi format response yang kita inginkan, lengkap dengan paginasi.
 */
export function toDashboardProcurementLettersResponse(
  letters: ProcurementLetterWithRelations[],
  total: number,
  page: number,
  limit: number,
  totalInUnit: number,
  totalApproved: number,
  totalRejected: number,
  latestNotes?: Record<string, LatestNoteResponse | undefined>
): GetDashboardProcurementsResponse {
  return {
    summary: { total_in_unit: totalInUnit, total_approved: totalApproved, total_rejected: totalRejected },
    letters: letters.map((letter) => toProcurementLetterResponse(letter, latestNotes?.[letter.id])),
    pagination: {
      total_data: total,
      page: page,
      limit: limit,
      total_page: Math.ceil(total / limit)
    }
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
  limit: number,
  latestNotes?: Record<string, LatestNoteResponse | undefined>
): GetAllProcurementLettersResponse {
  return {
    letters: letters.map((letter) => toProcurementLetterResponse(letter, latestNotes?.[letter.id])),
    pagination: {
      total_data: total,
      page: page,
      limit: limit,
      total_page: Math.ceil(total / limit)
    }
  }
}

export function toProgressResponse(
  letter: ProcurementLetterWithRelations,
  logs: ProcurementLogFormData[],
  latestNote?: LatestNoteResponse
): ProgressResponse {
  const serializedLetter = toProcurementLetterResponse(letter, latestNote)
  const serializedLogs = logs.map((log) => ({
    logId: log.logId,
    action: log.action,
    comment: log.comment,
    timestamp: log.timestamp,
    actor: log.actor,
    actorId: log.actor.id
  }))

  return {
    letter: serializedLetter,
    logs: serializedLogs
  }
}
export const toHistoryLogResponse = (
  logs: (ProcurementLog & { procurementLetter: ProcurementLetterWithRelations })[],
  total: number,
  page: number,
  limit: number
) => {
  const history = logs.map((log) => {
    return {
      logId: log.id,
      action: log.action,
      comment: log.comment,
      timestamp: log.timestamp,
      letter: toProcurementLetterResponse(log.procurementLetter)
    }
  })

  return {
    history,
    pagination: {
      total_data: total,
      page: page,
      limit: limit,
      total_page: Math.ceil(total / limit)
    }
  }
}

// ------- Fungsi helper serialisasi BigInt ------- //
function serializeBigInt(obj: any) {
  return JSON.parse(JSON.stringify(obj, (_, value) => (typeof value === 'bigint' ? value.toString() : value)))
}
