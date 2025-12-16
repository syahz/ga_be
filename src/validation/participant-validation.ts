import { z } from 'zod'

export class ParticipantValidation {
  static readonly CREATE = z.object({
    name: z.string().min(1, 'Nama wajib diisi'),
    email: z.email('Format email tidak valid'),
    unitId: z.uuid('Id Unit tidak valid'),
    roleId: z.uuid('Id Role tidak valid'),
    divisionId: z.uuid('Id Divisi tidak valid ')
  })

  static readonly UPDATE = z.object({
    name: z.string().min(1, 'Nama tidak boleh kosong').max(100).optional(),
    email: z.email('Format email tidak valid').optional(),
    roleId: z.uuid('Format Id Role tidak valid (UUID)').optional(),
    unitId: z.uuid('Format Id Unit tidak valid (UUID)').optional(),
    divisionId: z.uuid('Format Id Divisi tidak valid (UUID)').optional()
  })
}
