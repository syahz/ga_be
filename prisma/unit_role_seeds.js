require('dotenv/config')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')
const { PrismaMariaDb } = require('@prisma/adapter-mariadb')

function createAdapter(urlString) {
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
const prisma = new PrismaClient({ adapter })

// === Data Role (Tidak berubah) ===
const rolesToSeed = [
  { name: 'Staff' },
  { name: 'Manajer' },
  { name: 'General Manajer' },
  { name: 'Staff' },
  { name: 'Kepala Divisi' },
  { name: 'Direktur Operasional' },
  { name: 'Direktur Keuangan' },
  { name: 'Direktur Utama' },
  { name: 'Admin' }
]

const divisionsToSeed = [
  { name: 'Human Resources' },
  { name: 'Administration' },
  { name: 'Finance' },
  { name: 'Operational' },
  { name: 'General Affair' },
  { name: 'Media Social' },
  { name: 'IT Support' }
]

// === Data Unit (Tidak berubah) ===
const unitsToSeed = [
  { code: 'HO', name: 'Head Office' },
  { code: 'UBGH', name: 'UB Guest House' },
  { code: 'GBA', name: 'Griya Brawijaya' },
  { code: 'UBC', name: 'UB Coffee' },
  { code: 'BLC', name: 'Brawijaya Language Center' },
  { code: 'UBK', name: 'UB Kantin' },
  { code: 'UBSC', name: 'UB Sport Center' },
  { code: 'UMC', name: 'UB Merchandise & Creative' },
  { code: 'BCR', name: 'Brawijaya Catering' },
  { code: 'LPH', name: 'Lembaga Pemeriksa Halal Universitas Brawijaya' },
  { code: 'BTT', name: 'Brawijaya Tour & Travel' },
  { code: 'BST', name: 'Brawijaya Science & Technology' },
  { code: 'BPA', name: 'Brawijaya Property and Advertising' },
  { code: 'BOS', name: 'Brawijaya Outsourcing' },
  { code: 'AGRO', name: 'Depo Agro' }
]

// === Seeder Role (Tidak berubah) ===
async function seedRoles() {
  console.log('Seeding roles...')
  for (const roleData of rolesToSeed) {
    await prisma.role.upsert({
      where: { name: roleData.name },
      update: {},
      create: { name: roleData.name }
    })
  }
  console.log('Roles seeded successfully.')
}

async function seedDivisions() {
  console.log('Seeding divisions...')
  for (const divisionData of divisionsToSeed) {
    await prisma.division.upsert({
      where: { name: divisionData.name },
      update: {},
      create: { name: divisionData.name }
    })
  }
  console.log('Divisions seeded successfully.')
}

// === Seeder Unit (Tidak berubah) ===
async function seedUnits() {
  console.log('Seeding units...')
  for (const unitData of unitsToSeed) {
    await prisma.unit.upsert({
      where: { code: unitData.code },
      update: { name: unitData.name },
      create: {
        code: unitData.code,
        name: unitData.name
      }
    })
  }
  console.log('Units seeded successfully.')
}

// === Seeder Admin User (Tidak berubah) ===
async function seedAdminUser() {
  console.log('Seeding admin user...')

  const adminRole = await prisma.role.findUnique({
    where: { name: 'Admin' }
  })
  if (!adminRole) throw new Error('Role Admin belum ada.')

  const hoUnit = await prisma.unit.findUnique({
    where: { code: 'HO' }
  })
  if (!hoUnit) throw new Error('Unit HO belum ada.')

  const divisionAdmin = await prisma.division.findUnique({
    where: {
      name: 'IT Support'
    }
  })
  if (!divisionAdmin) throw new Error('Unit IT belum ada')

  const plainPassword = process.env.ADMIN_PASSWORD || 'admin12345'
  const passwordHash = await bcrypt.hash(plainPassword, 10)

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Administrator',
      roleId: adminRole.id,
      unitId: hoUnit.id,
      divisionId: divisionAdmin.id,
      password: passwordHash
    }
  })

  console.log('Admin user seeded successfully.')
  console.log('Admin default password set. Change via ENV ADMIN_PASSWORD.')
}

// === Main Runner (Tidak berubah) ===
async function main() {
  await seedRoles()
  await seedDivisions()
  await seedUnits()
  await seedAdminUser()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
