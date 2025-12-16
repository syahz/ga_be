import { Request } from 'express'
import { Prisma } from '@prisma/client'

export type UserWithRelations = Prisma.UserGetPayload<{
  include: { role: true; division: true; unit: true }
}>

export interface UserRequest extends Request {
  user?: UserWithRelations
}
