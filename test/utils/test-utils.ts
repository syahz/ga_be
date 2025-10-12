import { prismaClient } from '../../src/application/database'
import bcrypt from 'bcrypt'
import { Role, User, Unit, ProcurementRule, ProcurementStep, StepType } from '@prisma/client'
import jwt from 'jsonwebtoken'

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'your-secret-key-for-testing'

export type UserWithRole = User & { role: Role }

// Tipe data baru untuk request pembuatan user
type CreateUserRequest = {
  email: string
  name: string
  roleName: string
  unitCode: string
}

export class UserTest {
  /**
   * PENAMBAHAN: Membuat user baru berdasarkan nama role dan kode unit.
   * Ini akan menjadi fungsi utama untuk membuat user dalam tes.
   */
  static async createUserByRole(request: CreateUserRequest): Promise<UserWithRole> {
    const role = await prismaClient.role.findUnique({ where: { name: request.roleName } })
    if (!role) throw new Error(`Role '${request.roleName}' tidak ditemukan. Jalankan seeder.`)

    const unit = await prismaClient.unit.findUnique({ where: { code: request.unitCode } })
    if (!unit) throw new Error(`Unit '${request.unitCode}' tidak ditemukan. Jalankan seeder.`)

    return prismaClient.user.create({
      data: {
        email: request.email,
        name: request.name,
        password: await bcrypt.hash('password123', 10),
        roleId: role.id,
        unitId: unit.id
      },
      include: {
        role: true
      }
    })
  }

  /**
   * PENYESUAIAN: Fungsi createAdmin sekarang menggunakan createUserByRole
   * untuk konsistensi.
   */
  static async createAdmin(): Promise<UserWithRole> {
    return this.createUserByRole({
      email: 'test.admin@example.com',
      name: 'Test Admin',
      roleName: 'Admin',
      unitCode: 'HO'
    })
  }

  /**
   * Menghasilkan token JWT yang valid untuk user tertentu.
   * (Tidak ada perubahan)
   */
  static generateToken(user: UserWithRole): string {
    const payload = {
      userId: user.id,
      role: user.role.name
    }
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
  }

  /**
   * Membersihkan semua user yang dibuat untuk tes.
   * (Tidak ada perubahan)
   */
  static async delete() {
    await prismaClient.user.deleteMany({
      where: { email: { startsWith: 'test.' } }
    })
  }
}

export class RuleTest {
  // ... (Tidak ada perubahan di kelas RuleTest)
  /**
   * Membuat satu set aturan lengkap dengan 3 langkahnya.
   * @param overrideName - Nama unik untuk aturan agar tidak terjadi konflik.
   */

  static async seedAllProcurementRules() {
    // Ambil semua role yang dibutuhkan
    const roles = await prismaClient.role.findMany()
    const roleMap = new Map(roles.map((role) => [role.name, role.id]))

    const rulesToSeed = [
      {
        name: 'TEST-Hingga 2 Juta',
        minAmount: 0n,
        maxAmount: 2000000n,
        steps: [
          { stepOrder: 1, stepType: StepType.CREATE, roleName: 'Staff' },
          { stepOrder: 2, stepType: StepType.REVIEW, roleName: 'Manajer Keuangan' },
          { stepOrder: 3, stepType: StepType.APPROVE, roleName: 'GM' }
        ]
      },
      {
        name: 'TEST-Hingga 10 Juta',
        minAmount: 2000001n,
        maxAmount: 10000000n,
        steps: [
          { stepOrder: 1, stepType: StepType.CREATE, roleName: 'General Affair' },
          { stepOrder: 2, stepType: StepType.REVIEW, roleName: 'Kadiv Keuangan' },
          { stepOrder: 3, stepType: StepType.APPROVE, roleName: 'Direktur Keuangan' }
        ]
      }
      // Tambahkan aturan lain jika diperlukan untuk tes
    ]

    for (const ruleData of rulesToSeed) {
      const rule = await prismaClient.procurementRule.create({
        data: {
          name: ruleData.name,
          minAmount: ruleData.minAmount,
          maxAmount: ruleData.maxAmount
        }
      })

      const stepsData = ruleData.steps.map((step) => {
        const roleId = roleMap.get(step.roleName)
        if (!roleId) throw new Error(`Role '${step.roleName}' tidak ditemukan di database untuk seeding tes.`)
        return {
          ruleId: rule.id,
          roleId: roleId,
          stepOrder: step.stepOrder,
          stepType: step.stepType
        }
      })

      await prismaClient.procurementStep.createMany({
        data: stepsData
      })
    }
  }

  static async deleteAllProcurementData() {
    // Hapus dengan urutan yang benar untuk menghindari error foreign key
    await prismaClient.procurementLog.deleteMany({})
    await prismaClient.procurementLetter.deleteMany({})
    await prismaClient.procurementStep.deleteMany({})
    await prismaClient.procurementRule.deleteMany({
      where: { name: { startsWith: 'TEST-' } }
    })
  }

  static async createFullRule(overrideName: string): Promise<ProcurementRule & { steps: ProcurementStep[] }> {
    const roles = await prismaClient.role.findMany({
      where: { name: { in: ['Staff', 'Manajer Keuangan', 'GM'] } }
    })
    const roleMap = new Map(roles.map((r) => [r.name, r.id]))

    if (roles.length < 3) {
      throw new Error('Role Staff, Manajer Keuangan, atau GM tidak ditemukan. Jalankan seeder.')
    }

    const rule = await prismaClient.procurementRule.create({
      data: {
        name: overrideName,
        minAmount: 1,
        maxAmount: 1000000,
        steps: {
          createMany: {
            data: [
              { stepOrder: 1, stepType: 'CREATE', roleId: roleMap.get('Staff')! },
              { stepOrder: 2, stepType: 'REVIEW', roleId: roleMap.get('Manajer Keuangan')! },
              { stepOrder: 3, stepType: 'APPROVE', roleId: roleMap.get('GM')! }
            ]
          }
        }
      },
      include: {
        steps: true
      }
    })
    return rule
  }

  /**
   * Mendapatkan semua role dari database untuk digunakan di test case.
   */
  static async getRoles(): Promise<Role[]> {
    return prismaClient.role.findMany()
  }

  /**
   * Membersihkan semua aturan dan langkah yang dibuat untuk tes.
   */
  static async delete() {
    await prismaClient.procurementStep.deleteMany({
      where: { rule: { name: { startsWith: 'TEST-' } } }
    })
    await prismaClient.procurementRule.deleteMany({
      where: { name: { startsWith: 'TEST-' } }
    })
  }
}
