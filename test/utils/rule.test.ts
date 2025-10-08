import supertest from 'supertest'
import { web } from '../../src/application/web'
import { logger } from '../../src/utils/logger'
// PENYESUAIAN: Impor tipe UserWithRole
import { UserTest, RuleTest, UserWithRole } from '../utils/test-utils'
import { Role } from '@prisma/client'
import { prismaClient } from '../../src/application/database'

describe('Rule API (/api/admin/rules)', () => {
  // PENYESUAIAN: Ubah tipe variabel 'adminUser'
  let adminUser: UserWithRole
  let token: string
  let roles: Role[]

  // Berjalan sekali sebelum semua tes di file ini
  beforeAll(async () => {
    adminUser = await UserTest.createAdmin()
    // Sekarang baris ini tidak akan error karena 'adminUser' memiliki tipe yang benar
    token = UserTest.generateToken(adminUser)
    roles = await RuleTest.getRoles()
  })

  // Berjalan sekali setelah semua tes di file ini selesai
  afterAll(async () => {
    await UserTest.delete()
  })

  // Berjalan setelah setiap tes untuk membersihkan data aturan
  afterEach(async () => {
    await RuleTest.delete()
  })

  describe('POST /api/admin/rules', () => {
    it('should create a new rule with 3 steps successfully', async () => {
      const staffRole = roles.find((r) => r.name === 'Staff')
      const managerRole = roles.find((r) => r.name === 'Manajer Keuangan')
      const gmRole = roles.find((r) => r.name === 'GM')

      const response = await supertest(web)
        .post('/api/admin/rules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'TEST-Aturan Baru',
          minAmount: 500000,
          maxAmount: 2500000,
          steps: [
            { stepOrder: 1, stepType: 'CREATE', roleId: staffRole!.id },
            { stepOrder: 2, stepType: 'REVIEW', roleId: managerRole!.id },
            { stepOrder: 3, stepType: 'APPROVE', roleId: gmRole!.id }
          ]
        })

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(201)
      expect(response.body.data.name).toBe('TEST-Aturan Baru')
      expect(response.body.data.steps).toHaveLength(3)
      expect(response.body.data.steps[0].role.name).toBe('Staff')
    })

    it('should fail with 400 if steps are not exactly 3', async () => {
      const staffRole = roles.find((r) => r.name === 'Staff')
      const response = await supertest(web)
        .post('/api/admin/rules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'TEST-Aturan Gagal',
          minAmount: 1,
          maxAmount: 100,
          steps: [{ stepOrder: 1, stepType: 'CREATE', roleId: staffRole!.id }]
        })

      expect(response.status).toBe(400)
      expect(response.body.errors).toContain('Harus ada tepat 3 langkah persetujuan')
    })

    it('should fail with 401 if not authenticated', async () => {
      const response = await supertest(web).post('/api/admin/rules').send({})
      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/admin/rules', () => {
    it('should get all rules with their steps', async () => {
      await RuleTest.createFullRule('TEST-Aturan A')
      await RuleTest.createFullRule('TEST-Aturan B')

      const response = await supertest(web).get('/api/admin/rules').set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.data.length).toBe(2)
      expect(response.body.data[0].name).toBe('TEST-Aturan A')
      expect(response.body.data[0].steps).toHaveLength(3)
    })
  })

  describe('PUT /api/admin/rules/:ruleId', () => {
    it('should update rule details successfully', async () => {
      const rule = await RuleTest.createFullRule('TEST-Untuk Diupdate')

      const response = await supertest(web)
        .put(`/api/admin/rules/${rule.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'TEST-Sudah Diupdate', minAmount: 1000 })

      expect(response.status).toBe(200)
      expect(response.body.data.name).toBe('TEST-Sudah Diupdate')
      expect(response.body.data.minAmount).toBe('1000')
    })
  })

  describe('PUT /api/admin/rules/step/:stepId', () => {
    it('should update a single step role successfully', async () => {
      const rule = await RuleTest.createFullRule('TEST-Update Step')
      const stepToUpdate = rule.steps.find((s) => s.stepOrder === 2) // Ambil step REVIEW
      const dirOpsRole = roles.find((r) => r.name === 'Direktur Operasional')

      const response = await supertest(web)
        .put(`/api/admin/rules/step/${stepToUpdate!.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ roleId: dirOpsRole!.id })

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(stepToUpdate!.id)
      expect(response.body.data.role.name).toBe('Direktur Operasional')
    })
  })

  describe('DELETE /api/admin/rules/:ruleId', () => {
    it('should delete a rule and its steps successfully', async () => {
      const rule = await RuleTest.createFullRule('TEST-Untuk Dihapus')

      const response = await supertest(web).delete(`/api/admin/rules/${rule.id}`).set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.data.message).toBe('Aturan berhasil dihapus')

      // Verifikasi ke DB bahwa rule sudah tidak ada
      const findRule = await prismaClient.procurementRule.findUnique({ where: { id: rule.id } })
      expect(findRule).toBeNull()
    })
  })
})
