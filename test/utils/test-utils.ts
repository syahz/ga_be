import { prismaClient } from '../../src/application/database'
import bcrypt from 'bcrypt'
import { Role, User, Unit, ProcurementRule, ProcurementStep } from '@prisma/client'
import jwt from 'jsonwebtoken'

// PENYESUAIAN: Gunakan nama environment variable yang sama dengan di aplikasi utama
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'your-secret-key-for-testing'

// PENYESUAIAN: Tambahkan 'export' agar tipe ini bisa diimpor di file tes lain
export type UserWithRole = User & { role: Role }

export class UserTest {
  /**
   * Membuat user admin untuk keperluan tes otentikasi.
   * PENYESUAIAN: Sekarang me-return user beserta relasi rolenya.
   */
  static async createAdmin(): Promise<UserWithRole> {
    const role = await prismaClient.role.findUnique({ where: { name: 'Admin' } })
    if (!role) throw new Error("Role 'Admin' tidak ditemukan. Jalankan seeder.")

    const unit = await prismaClient.unit.findUnique({ where: { code: 'HO' } })
    if (!unit) throw new Error("Unit 'HO' tidak ditemukan. Jalankan seeder.")

    return prismaClient.user.create({
      data: {
        email: 'test.admin@example.com',
        name: 'Test Admin',
        password: await bcrypt.hash('password123', 10),
        roleId: role.id,
        unitId: unit.id
      },
      include: {
        role: true // Pastikan role di-include
      }
    })
  }

  /**
   * Menghasilkan token JWT yang valid untuk user tertentu.
   * PENYESUAIAN: Payload sekarang mencakup 'role' agar sesuai dengan aplikasi.
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
   */
  static async delete() {
    await prismaClient.user.deleteMany({
      where: { email: { startsWith: 'test.' } }
    })
  }
}

export class RuleTest {
  /**
   * Membuat satu set aturan lengkap dengan 3 langkahnya.
   * @param overrideName - Nama unik untuk aturan agar tidak terjadi konflik.
   */
  static async createFullRule(overrideName: string): Promise<ProcurementRule & { steps: ProcurementStep[] }> {
    // Ambil role yang dibutuhkan dari DB
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
    // Hapus 'steps' dulu karena berelasi dengan 'rules'
    await prismaClient.procurementStep.deleteMany({
      where: { rule: { name: { startsWith: 'TEST-' } } }
    })
    await prismaClient.procurementRule.deleteMany({
      where: { name: { startsWith: 'TEST-' } }
    })
  }
}
