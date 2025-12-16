import { z } from 'zod'

export class UserValidation {
  static readonly REGISTER = z.object({
    email: z.email().min(5).max(100),
    name: z.string().min(1).max(100)
  })

  static readonly UPDATEACCOUNT = z.object({
    name: z.string().max(100).optional(),
    email: z.email().max(100).optional()
  })
}
