import { z } from 'zod'

export class RoleValidation {
  static readonly CREATE = z.object({
    name: z.string().min(1, 'Nama role tidak boleh kosong').max(100, 'Nama role maksimal 100 karakter')
  })

  static readonly UPDATE = z.object({
    name: z.string().min(1, 'Nama role tidak boleh kosong').max(100, 'Nama role maksimal 100 karakter').optional()
  })
}
