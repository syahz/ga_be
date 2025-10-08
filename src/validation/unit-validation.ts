import { z } from 'zod'

export class UnitValidation {
  static readonly CREATE = z.object({
    code: z.string().min(1, 'Kode unit tidak boleh kosong').max(10, 'Kode unit maksimal 10 karakter'),
    name: z.string().min(1, 'Nama unit tidak boleh kosong').max(100, 'Nama unit maksimal 100 karakter')
  })

  static readonly UPDATE = z.object({
    code: z.string().min(1, 'Kode unit tidak boleh kosong').max(10, 'Kode unit maksimal 10 karakter').optional(),
    name: z.string().min(1, 'Nama unit tidak boleh kosong').max(100, 'Nama unit maksimal 100 karakter').optional()
  })
}
