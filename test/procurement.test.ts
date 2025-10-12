import supertest from 'supertest'
import { web } from '../src/application/web'
import { logger } from '../src/utils/logger'
import { UserTest, UserWithRole, RuleTest } from './utils/test-utils'
import { prismaClient } from '../src/application/database'
import { ProcurementLetterResponse } from '../src/models/procurement-model'
import { Unit } from '@prisma/client'

describe('Procurement API (/api/admin/procurement)', () => {
  // Users untuk aturan <= 2 Juta (di unit UBC)
  let staffUser: UserWithRole
  let staffToken: string
  let managerUser: UserWithRole
  let managerToken: string
  let gmUser: UserWithRole
  let gmToken: string
  let unitUBC: Unit

  // Users untuk aturan > 2 Juta (di unit HO)
  let gaUser: UserWithRole
  let gaToken: string
  let kadivKeuanganUser: UserWithRole

  beforeAll(async () => {
    // --- Ambil Data Unit ---
    const ubc = await prismaClient.unit.findUnique({ where: { code: 'UBC' } })
    if (!ubc) throw new Error("Unit 'UBC' tidak ditemukan. Jalankan seeder.")
    unitUBC = ubc

    // --- SETUP PENGGUNA ---
    staffUser = await UserTest.createUserByRole({
      email: 'test.staff.ubc@example.com',
      name: 'Test Staff UBC',
      roleName: 'Staff',
      unitCode: 'UBC'
    })
    staffToken = UserTest.generateToken(staffUser)

    managerUser = await UserTest.createUserByRole({
      email: 'test.manager.ubc@example.com',
      name: 'Test Manager Keuangan UBC',
      roleName: 'Manajer Keuangan',
      unitCode: 'UBC'
    })
    managerToken = UserTest.generateToken(managerUser)

    gmUser = await UserTest.createUserByRole({
      email: 'test.gm.ubc@example.com',
      name: 'Test GM UBC',
      roleName: 'GM',
      unitCode: 'UBC'
    })
    gmToken = UserTest.generateToken(gmUser)

    gaUser = await UserTest.createUserByRole({
      email: 'test.ga.ho@example.com',
      name: 'Test GA HO',
      roleName: 'General Affair',
      unitCode: 'HO'
    })
    gaToken = UserTest.generateToken(gaUser)

    kadivKeuanganUser = await UserTest.createUserByRole({
      email: 'test.kadiv.ho@example.com',
      name: 'Test Kadiv Keuangan HO',
      roleName: 'Kadiv Keuangan',
      unitCode: 'HO'
    })

    // --- SETUP ATURAN ---
    await RuleTest.seedAllProcurementRules()
  })

  afterAll(async () => {
    await UserTest.delete()
    await RuleTest.deleteAllProcurementData()
  })

  afterEach(async () => {
    await prismaClient.procurementLog.deleteMany({})
    await prismaClient.procurementLetter.deleteMany({
      where: { letterNumber: { startsWith: 'TEST-' } }
    })
  })

  describe('POST /api/admin/procurement', () => {
    it('should create a new procurement letter successfully by authorized role (<= 2 Juta)', async () => {
      const response = await supertest(web).post('/api/admin/procurement').set('Authorization', `Bearer ${staffToken}`).send({
        letterNumber: 'TEST-001',
        letterAbout: 'Pengadaan ATK',
        nominal: 1500000,
        incomingLetterDate: new Date().toISOString(),
        unitId: unitUBC.id
      })

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(201)
      expect(response.body.data.letterNumber).toBe('TEST-001')
      expect(response.body.data.status).toBe('PENDING_REVIEW')
      expect(response.body.data.nominal).toBe('1500000')
      expect(response.body.data.currentApproverId).toBe(managerUser.id)
    })

    it('should fail to create with 403 if role is not authorized for the nominal', async () => {
      const response = await supertest(web)
        .post('/api/admin/procurement')
        .set('Authorization', `Bearer ${staffToken}`) // Staff
        .send({
          letterNumber: 'TEST-002',
          letterAbout: 'Pengadaan Laptop',
          nominal: 5000000, // Nominal ini seharusnya dibuat oleh General Affair
          incomingLetterDate: new Date().toISOString(),
          unitId: unitUBC.id
        })

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(403)
      expect(response.body.errors).toContain('tidak berwenang membuat pengadaan senilai ini')
    })

    it('should create successfully by GA for nominal > 2 Juta', async () => {
      const response = await supertest(web)
        .post('/api/admin/procurement')
        .set('Authorization', `Bearer ${gaToken}`) // General Affair
        .send({
          letterNumber: 'TEST-003',
          letterAbout: 'Pengadaan Laptop Kantor',
          nominal: 5000000,
          incomingLetterDate: new Date().toISOString(),
          unitId: unitUBC.id // GA dari HO membuatkan pengadaan untuk unit UBC
        })

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(201)
      expect(response.body.data.letterNumber).toBe('TEST-003')
      expect(response.body.data.status).toBe('PENDING_REVIEW')
      expect(response.body.data.currentApproverId).toBe(kadivKeuanganUser.id)
    })
  })

  describe('GET /api/admin/procurement', () => {
    it('should appear on the next approver dashboard', async () => {
      await supertest(web).post('/api/admin/procurement').set('Authorization', `Bearer ${staffToken}`).send({
        letterNumber: 'TEST-DASH-001',
        letterAbout: 'Pengadaan untuk Dashboard',
        nominal: 1000000,
        incomingLetterDate: new Date().toISOString(),
        unitId: unitUBC.id
      })

      const response = await supertest(web).get('/api/admin/procurement').set('Authorization', `Bearer ${managerToken}`)

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.letters).toHaveLength(1)
      expect(response.body.data.letters[0].letterNumber).toBe('TEST-DASH-001')
    })
  })

  describe('POST /api/admin/procurement/decision/:letterId', () => {
    let letter: ProcurementLetterResponse

    beforeEach(async () => {
      const createResponse = await supertest(web)
        .post('/api/admin/procurement')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          letterNumber: `TEST-DECISION-${Date.now()}`,
          letterAbout: 'Untuk Proses Keputusan',
          nominal: 1200000,
          incomingLetterDate: new Date().toISOString(),
          unitId: unitUBC.id
        })
      letter = createResponse.body.data
    })

    it('should allow the first approver (Manager) to review and pass to the next (GM)', async () => {
      const response = await supertest(web).post(`/api/admin/procurement/decision/${letter.id}`).set('Authorization', `Bearer ${managerToken}`).send({
        decision: 'APPROVE',
        comment: 'Reviewed by Manager'
      })

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.status).toBe('PENDING_APPROVAL')
      expect(response.body.data.currentApproverId).toBe(gmUser.id)
    })

    it('should allow the final approver (GM) to approve the letter', async () => {
      // Langkah 1: Manajer Keuangan melakukan REVIEW
      await supertest(web)
        .post(`/api/admin/procurement/decision/${letter.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ decision: 'APPROVE' })

      // Langkah 2: GM melakukan APPROVE final
      const finalResponse = await supertest(web).post(`/api/admin/procurement/decision/${letter.id}`).set('Authorization', `Bearer ${gmToken}`).send({
        decision: 'APPROVE',
        comment: 'Final approval by GM'
      })

      logger.debug(JSON.stringify(finalResponse.body, null, 2))
      expect(finalResponse.status).toBe(200)
      expect(finalResponse.body.data.status).toBe('APPROVED')
      expect(finalResponse.body.data.currentApproverId).toBeNull()
    })

    it('should fail with 403 if an unauthorized user tries to make a decision', async () => {
      const response = await supertest(web)
        .post(`/api/admin/procurement/decision/${letter.id}`)
        .set('Authorization', `Bearer ${staffToken}`) // Staff tidak berwenang
        .send({ decision: 'APPROVE' })

      logger.debug(JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(403)
      expect(response.body.errors).toBe('You are not authorized to process this letter.')
    })
  })
})
