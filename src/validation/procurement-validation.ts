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
      .string('Nominal harus berupa angka')
      .refine((val) => !isNaN(Number(val)), {
        message: 'Nominal harus berupa angka'
      })
      .transform((val) => BigInt(val)),

    // Menggunakan .refine untuk validasi tanggal yang lebih kompatibel
    incomingLetterDate: z
      .string()
      .min(1, 'Tanggal surat masuk harus diisi')
      .refine((date) => !isNaN(Date.parse(date)), {
        message: 'Format tanggal surat masuk tidak valid'
      }),

    letterFile: z.string().optional(),
    unitId: z.uuid('unitId harus berupa UUID'),
    note: z.string().max(1000, 'Catatan maksimal 1000 karakter').optional()
  })

  /**
   * Skema untuk validasi data saat Mengubah surat pengadaan.
   * Cocok dengan DTO `UpdateProcurementRequestDto`.
   */
  static readonly UPDATE = z.object({
    letterNumber: z.string().min(1, 'Nomor surat tidak boleh kosong').max(100, 'Nomor surat maksimal 100 karakter'),
    letterAbout: z.string().min(1, 'Perihal surat tidak boleh kosong').max(255, 'Perihal surat maksimal 255 karakter'),
    nominal: z
      .string('Nominal harus berupa angka')
      .refine((val) => !isNaN(Number(val)), {
        message: 'Nominal harus berupa angka'
      })
      .transform((val) => BigInt(val)),

    // Menggunakan .refine untuk validasi tanggal yang lebih kompatibel
    incomingLetterDate: z
      .string()
      .min(1, 'Tanggal surat masuk harus diisi')
      .refine((date) => !isNaN(Date.parse(date)), {
        message: 'Format tanggal surat masuk tidak valid'
      }),

    letterFile: z.string().optional(),
    unitId: z.uuid('unitId harus berupa UUID')
  })

  /**
   * Skema untuk validasi data saat memproses keputusan.
   * Cocok dengan DTO `ProcessDecisionRequestDto`.
   */
  static readonly PROCESS_DECISION = z.object({
    decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_REVISION']),

    comment: z.string().max(1000, 'Komentar maksimal 1000 karakter').optional()
  })
}
