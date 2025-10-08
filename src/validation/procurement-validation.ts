import { z } from 'zod'

export class ProcurementValidation {
  /**
   * Skema untuk validasi data saat membuat surat pengadaan baru.
   * Cocok dengan DTO `CreateProcurementRequestDto`.
   */
  static readonly CREATE = z.object({
    letterNumber: z.string().min(1, 'Nomor surat tidak boleh kosong').max(100, 'Nomor surat maksimal 100 karakter'),

    letterAbout: z.string().min(1, 'Perihal surat tidak boleh kosong').max(255, 'Perihal surat maksimal 255 karakter'),

    nominal: z
      .number()
      .refine((value) => typeof value === 'number', {
        message: 'Nominal harus berupa angka'
      })
      .positive('Nominal harus angka positif'),

    // Menggunakan .refine untuk validasi tanggal yang lebih kompatibel
    incomingLetterDate: z
      .string()
      .min(1, 'Tanggal surat masuk harus diisi')
      .refine((date) => !isNaN(Date.parse(date)), {
        message: 'Format tanggal surat masuk tidak valid'
      }),

    letterFile: z.string().optional()
  })

  /**
   * Skema untuk validasi data saat memproses keputusan.
   * Cocok dengan DTO `ProcessDecisionRequestDto`.
   */
  static readonly PROCESS_DECISION = z.object({
    // Menghapus objek error dan menggunakan z.enum standar
    decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_REVISION']),

    comment: z.string().max(1000, 'Komentar maksimal 1000 karakter').optional()
  })
}
