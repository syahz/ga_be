import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

function createAdapter(urlString: string) {
  const url = new URL(urlString)
  const host = url.hostname
  const port = url.port ? Number(url.port) : 3306
  const user = decodeURIComponent(url.username)
  const password = decodeURIComponent(url.password)
  const database = url.pathname.replace(/^\//, '') || undefined
  return new PrismaMariaDb({ host, port, user, password, database })
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL not set')
}

const adapter = createAdapter(databaseUrl)
export const prismaClient = new PrismaClient({ adapter })
