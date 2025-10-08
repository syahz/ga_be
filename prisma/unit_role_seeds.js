// prisma/seed.ts

import { PrismaClient, StepType } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

// === Data Role (Tidak berubah) ===
const rolesToSeed = [
  { name: 'Staff' },
  { name: 'Manajer Keuangan' },
  { name: 'GM' },
  { name: 'General Affair' },
  { name: 'Kadiv Keuangan' },
  { name: 'Direktur Operasional' },
  { name: 'Direktur Keuangan' },
  { name: 'Direktur Utama' },
  { name: 'Admin' }
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

// --- PERUBAHAN: Data Aturan Pengadaan dengan Struktur Baru ---
const procurementRulesToSeed = [
  // Aturan 1: Hingga 2 Juta
  {
    name: 'Hingga 2 Juta',
    minAmount: 0n,
    maxAmount: 2000000n,
    steps: [
      { stepOrder: 1, stepType: StepType.CREATE, roleName: 'Staff' },
      { stepOrder: 2, stepType: StepType.REVIEW, roleName: 'Manajer Keuangan' },
      { stepOrder: 3, stepType: StepType.APPROVE, roleName: 'GM' }
    ]
  },

  // Aturan 2: Hingga 10 Juta
  {
    name: 'Hingga 10 Juta',
    minAmount: 2000001n,
    maxAmount: 10000000n,
    steps: [
      { stepOrder: 1, stepType: StepType.CREATE, roleName: 'General Affair' },
      { stepOrder: 2, stepType: StepType.REVIEW, roleName: 'Kadiv Keuangan' },
      { stepOrder: 3, stepType: StepType.APPROVE, roleName: 'Direktur Keuangan' }
    ]
  },

  // Aturan 3: Hingga 50 Juta
  {
    name: 'Hingga 50 Juta',
    minAmount: 10000001n,
    maxAmount: 50000000n,
    steps: [
      { stepOrder: 1, stepType: StepType.CREATE, roleName: 'GM' },
      { stepOrder: 2, stepType: StepType.REVIEW, roleName: 'Direktur Operasional' },
      { stepOrder: 3, stepType: StepType.APPROVE, roleName: 'Direktur Utama' }
    ]
  },

  // Aturan 4: Di Atas 50 Juta
  {
    name: 'Di Atas 50 Juta',
    minAmount: 50000001n,
    maxAmount: null,
    steps: [
      { stepOrder: 1, stepType: StepType.CREATE, roleName: 'Direktur Operasional' },
      { stepOrder: 2, stepType: StepType.REVIEW, roleName: 'Direktur Keuangan' },
      { stepOrder: 3, stepType: StepType.APPROVE, roleName: 'Direktur Utama' }
    ]
  }
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

// --- PERUBAHAN: Seeder Aturan Pengadaan yang Telah Direfactor ---
async function seedProcurementRules() {
  console.log('Seeding procurement rules and steps...')

  // Hapus semua data lama untuk memastikan data bersih.
  // PENTING: Hapus 'steps' terlebih dahulu karena memiliki foreign key ke 'rules'.
  await prisma.procurementStep.deleteMany({})
  await prisma.procurementRule.deleteMany({})

  // Ambil semua role dari DB untuk mendapatkan ID-nya
  const roles = await prisma.role.findMany()
  const roleMap = new Map(roles.map((role) => [role.name, role.id]))

  for (const ruleData of procurementRulesToSeed) {
    // 1. Buat entri ProcurementRule terlebih dahulu
    const newRule = await prisma.procurementRule.create({
      data: {
        name: ruleData.name,
        minAmount: ruleData.minAmount,
        maxAmount: ruleData.maxAmount
      }
    })

    console.log(`Created rule: ${newRule.name} (ID: ${newRule.id})`)

    // 2. Buat entri ProcurementStep untuk setiap langkah yang terhubung dengan Rule di atas
    for (const stepData of ruleData.steps) {
      const roleId = roleMap.get(stepData.roleName)
      if (!roleId) {
        console.warn(`Peringatan: Role "${stepData.roleName}" tidak ditemukan, melewati seeding langkah ini.`)
        continue
      }

      await prisma.procurementStep.create({
        data: {
          ruleId: newRule.id, // Hubungkan ke ID rule yang baru dibuat
          roleId: roleId,
          stepOrder: stepData.stepOrder,
          stepType: stepData.stepType
        }
      })
    }
  }
  console.log('Procurement rules and steps seeded successfully.')
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

  const hashedPassword = await bcrypt.hash('admin123', 10)

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Administrator',
      password: hashedPassword,
      roleId: adminRole.id,
      unitId: hoUnit.id
    }
  })

  console.log('Admin user seeded successfully.')
}

// === Main Runner (Tidak berubah) ===
async function main() {
  await seedRoles()
  await seedUnits()
  await seedProcurementRules() // Memanggil seeder aturan yang sudah direfactor
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
