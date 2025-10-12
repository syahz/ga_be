import supertest from 'supertest'
import { web } from '../src/application/web'
import { logger } from '../src/utils/logger'
import { UserTest, RuleTest, UserWithRole } from './utils/test-utils' // Path disesuaikan
import { Role } from '@prisma/client'
import { prismaClient } from '../src/application/database'

describe('Rule API (/api/admin/rules)', () => {
  let adminUser: UserWithRole
  let token: string
  let roles: Role[]

  beforeAll(async () => {
    adminUser = await UserTest.createAdmin()
    token = UserTest.generateToken(adminUser)
    roles = await RuleTest.getRoles()
  })

  afterAll(async () => {
    await UserTest.delete()
  })

  afterEach(async () => {
    await RuleTest.delete()
  })

  // --- TIDAK ADA PERUBAHAN FUNGSIONAL DI BAWAH INI ---

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
      // Penyesuaian: body response sekarang memiliki properti 'data'
      expect(response.body.data).toHaveLength(2)
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
      // Nilai BigInt dikembalikan sebagai string
      expect(response.body.data.minAmount).toBe('1000')
    })
  })

  describe('PUT /api/admin/rules/step/:stepId', () => {
    it('should update a single step role successfully', async () => {
      const rule = await RuleTest.createFullRule('TEST-Update Step')
      const stepToUpdate = rule.steps.find((s) => s.stepOrder === 2)
      const dirOpsRole = roles.find((r) => r.name === 'Direktur Operasional')

      const response = await supertest(web)
        .put(`/api/admin/rules/step/${stepToUpdate!.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ roleId: dirOpsRole!.id })

      expect(response.status).toBe(200)
      // Respon berisi seluruh objek rule yang diperbarui
      const updatedStep = response.body.data.steps.find((s: any) => s.id === stepToUpdate!.id)
      expect(updatedStep.role.name).toBe('Direktur Operasional')
    })
  })

  describe('DELETE /api/admin/rules/:ruleId', () => {
    it('should delete a rule and its steps successfully', async () => {
      const rule = await RuleTest.createFullRule('TEST-Untuk Dihapus')

      const response = await supertest(web).delete(`/api/admin/rules/${rule.id}`).set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.data.message).toBe('Aturan berhasil dihapus')

      const findRule = await prismaClient.procurementRule.findUnique({ where: { id: rule.id } })
      expect(findRule).toBeNull()
    })
  })
})
