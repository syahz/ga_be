import { z } from 'zod'

export class DivisionValidation {
  static readonly CREATE = z.object({
    name: z.string().min(1, 'Nama division tidak boleh kosong').max(100, 'Nama division maksimal 100 karakter')
  })

  static readonly UPDATE = z.object({
    name: z.string().min(1, 'Nama division tidak boleh kosong').max(100, 'Nama division maksimal 100 karakter').optional()
  })
}
