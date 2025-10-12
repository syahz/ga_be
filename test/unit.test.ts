import supertest from 'supertest'
import { web } from '../src/application/web'
import { logger } from '../src/utils/logger'
import { UserTest, UserWithRole } from './utils/test-utils'
import { prismaClient } from '../src/application/database'

describe('Unit API (/api/admin/units)', () => {
  let adminUser: UserWithRole
  let adminToken: string

  beforeAll(async () => {
    adminUser = await UserTest.createAdmin()
    adminToken = UserTest.generateToken(adminUser)
  })

  afterAll(async () => {
    await UserTest.delete()
  })

  // Bersihkan data unit yang dibuat untuk tes setelah setiap tes
  afterEach(async () => {
    await prismaClient.unit.deleteMany({
      where: {
        OR: [{ code: { startsWith: 'TEST-' } }, { name: { startsWith: 'TEST-' } }]
      }
    })
  })

  describe('POST /api/admin/units', () => {
    it('should create a new unit successfully', async () => {
      const response = await supertest(web).post('/api/admin/units').set('Authorization', `Bearer ${adminToken}`).send({
        code: 'TEST-NEW',
        name: 'TEST-UnitBaru'
      })

      logger.debug('POST /api/admin/units (success): %o', response.body)
      expect(response.status).toBe(201)
      expect(response.body.data.code).toBe('TEST-NEW')
      expect(response.body.data.name).toBe('TEST-UnitBaru')
      expect(response.body.data).toHaveProperty('id')
    })

    it('should fail with 409 if unit code already exists', async () => {
      await prismaClient.unit.create({ data: { code: 'TEST-DUP-C', name: 'TEST-UnitLama' } })

      const response = await supertest(web).post('/api/admin/units').set('Authorization', `Bearer ${adminToken}`).send({
        code: 'TEST-DUP-C',
        name: 'TEST-UnitGagal'
      })

      logger.debug('POST /api/admin/units (duplicate code): %o', response.body)
      expect(response.status).toBe(409)
      expect(response.body.errors).toBe('Kode atau Nama unit sudah ada')
    })

    it('should fail with 409 if unit name already exists', async () => {
      await prismaClient.unit.create({ data: { code: 'TEST-OLD-N', name: 'TEST-UnitDuplikat' } })

      const response = await supertest(web).post('/api/admin/units').set('Authorization', `Bearer ${adminToken}`).send({
        code: 'TEST-NEW-N',
        name: 'TEST-UnitDuplikat'
      })

      logger.debug('POST /api/admin/units (duplicate name): %o', response.body)
      expect(response.status).toBe(409)
      expect(response.body.errors).toBe('Kode atau Nama unit sudah ada')
    })

    it('should fail with 401 if not authenticated', async () => {
      const response = await supertest(web).post('/api/admin/units').send({ code: 'FAIL', name: 'TEST-NoAuth' })

      logger.debug('POST /api/admin/units (unauthenticated): %o', response.body)
      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/admin/units', () => {
    beforeEach(async () => {
      await prismaClient.unit.createMany({
        data: [
          { code: 'TEST-A', name: 'TEST-Unit A' },
          { code: 'TEST-B', name: 'TEST-Unit B' },
          { code: 'TEST-C', name: 'TEST-Unit C' }
        ]
      })
    })

    it('should get a paginated list of units', async () => {
      const totalUnits = await prismaClient.unit.count()
      const response = await supertest(web).get('/api/admin/units?page=1&limit=2').set('Authorization', `Bearer ${adminToken}`)

      logger.debug('GET /api/admin/units (paginated): %o', response.body)
      expect(response.status).toBe(200)
      expect(response.body.data.units).toHaveLength(2)
      expect(response.body.data.pagination.total_data).toBe(totalUnits)
    })

    it('should get a list of units with search query on name', async () => {
      const response = await supertest(web).get('/api/admin/units?search=Unit A').set('Authorization', `Bearer ${adminToken}`)

      logger.debug('GET /api/admin/units (search name): %o', response.body)
      expect(response.status).toBe(200)
      expect(response.body.data.units).toHaveLength(1)
      expect(response.body.data.units[0].name).toBe('TEST-Unit A')
    })

    it('should get a list of units with search query on code', async () => {
      const response = await supertest(web).get('/api/admin/units?search=TEST-C').set('Authorization', `Bearer ${adminToken}`)

      logger.debug('GET /api/admin/units (search code): %o', response.body)
      expect(response.status).toBe(200)
      expect(response.body.data.units).toHaveLength(1)
      expect(response.body.data.units[0].code).toBe('TEST-C')
    })
  })

  describe('GET /api/admin/units/all', () => {
    it('should get all units without pagination', async () => {
      const totalUnits = await prismaClient.unit.count()
      await prismaClient.unit.createMany({
        data: [
          { code: 'TEST-X', name: 'TEST-Unit X' },
          { code: 'TEST-Y', name: 'TEST-Unit Y' }
        ]
      })

      const response = await supertest(web).get('/api/admin/units/all').set('Authorization', `Bearer ${adminToken}`)

      logger.debug('GET /api/admin/units/all: %o', response.body)
      expect(response.status).toBe(200)
      expect(response.body.data.length).toBe(totalUnits + 2)
    })
  })

  describe('GET /api/admin/units/:unitId', () => {
    it('should get a unit by its ID', async () => {
      const newUnit = await prismaClient.unit.create({ data: { code: 'TEST-DET', name: 'TEST-DetailUnit' } })

      const response = await supertest(web).get(`/api/admin/units/${newUnit.id}`).set('Authorization', `Bearer ${adminToken}`)

      logger.debug('GET /api/admin/units/:unitId (success): %o', response.body)
      expect(response.status).toBe(200)
      expect(response.body.data.name).toBe('TEST-DetailUnit')
    })

    it('should fail with 404 if unit ID is not found', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await supertest(web).get(`/api/admin/units/${nonExistentId}`).set('Authorization', `Bearer ${adminToken}`)

      logger.debug('GET /api/admin/units/:unitId (not found): %o', response.body)
      expect(response.status).toBe(404)
    })
  })

  describe('PUT /api/admin/units/:unitId', () => {
    it('should update a unit successfully', async () => {
      const unitToUpdate = await prismaClient.unit.create({ data: { code: 'TEST-OLD', name: 'TEST-UnitLama' } })

      const response = await supertest(web)
        .put(`/api/admin/units/${unitToUpdate.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'TEST-NEW', name: 'TEST-UnitTerupdate' })

      logger.debug('PUT /api/admin/units/:unitId (success): %o', response.body)
      expect(response.status).toBe(200)
      expect(response.body.data.name).toBe('TEST-UnitTerupdate')
      expect(response.body.data.code).toBe('TEST-NEW')
    })

    it('should fail with 409 if new name already exists', async () => {
      await prismaClient.unit.create({ data: { code: 'EXIST', name: 'TEST-NamaSudahAda' } })
      const unitToUpdate = await prismaClient.unit.create({ data: { code: 'FAIL-U', name: 'TEST-AkanGagalUpdate' } })

      const response = await supertest(web)
        .put(`/api/admin/units/${unitToUpdate.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'TEST-NamaSudahAda' })

      logger.debug('PUT /api/admin/units/:unitId (duplicate name): %o', response.body)
      expect(response.status).toBe(409)
      expect(response.body.errors).toBe('Kode atau Nama unit sudah digunakan oleh unit lain')
    })
  })

  describe('DELETE /api/admin/units/:unitId', () => {
    it('should delete a unit successfully if not in use', async () => {
      const unitToDelete = await prismaClient.unit.create({ data: { code: 'DEL-OK', name: 'TEST-AkanDihapus' } })

      const response = await supertest(web).delete(`/api/admin/units/${unitToDelete.id}`).set('Authorization', `Bearer ${adminToken}`)

      logger.debug('DELETE /api/admin/units/:unitId (success): %o', response.body)
      expect(response.status).toBe(200)
      expect(response.body.data.message).toBe('Unit berhasil dihapus')

      // Verifikasi bahwa unit benar-benar terhapus
      const findUnit = await prismaClient.unit.findUnique({ where: { id: unitToDelete.id } })
      expect(findUnit).toBeNull()
    })

    it('should fail with 400 if unit is still in use by a user', async () => {
      // User admin yang dibuat di beforeAll menggunakan unit 'HO'
      const hoUnit = await prismaClient.unit.findUnique({ where: { code: 'HO' } })

      const response = await supertest(web).delete(`/api/admin/units/${hoUnit!.id}`).set('Authorization', `Bearer ${adminToken}`)

      logger.debug('DELETE /api/admin/units/:unitId (in use): %o', response.body)
      expect(response.status).toBe(400)
      expect(response.body.errors).toContain('Unit tidak dapat dihapus karena masih terhubung dengan')
    })
  })
})
