import supertest from 'supertest'
import { web } from '../src/application/web'
import { logger } from '../src/utils/logger'
import { UserTest, UserWithRole } from './utils/test-utils'
import { prismaClient } from '../src/application/database'
import { Role, Unit } from '@prisma/client'

describe('Participant API (/api/admin/participants)', () => {
  let adminUser: UserWithRole
  let adminToken: string
  let staffRole: Role
  let ubcUnit: Unit

  beforeAll(async () => {
    adminUser = await UserTest.createAdmin()
    adminToken = UserTest.generateToken(adminUser)

    // Ambil data Role dan Unit yang sudah ada dari seeder untuk digunakan saat membuat user
    const staff = await prismaClient.role.findUnique({ where: { name: 'Staff' } })
    if (!staff) throw new Error("Role 'Staff' tidak ditemukan. Jalankan seeder.")
    staffRole = staff

    const ubc = await prismaClient.unit.findUnique({ where: { code: 'UBC' } })
    if (!ubc) throw new Error("Unit 'UBC' tidak ditemukan. Jalankan seeder.")
    ubcUnit = ubc
  })

  afterAll(async () => {
    await UserTest.delete()
  })

  // Hapus semua user yang dibuat khusus untuk tes
  afterEach(async () => {
    await prismaClient.user.deleteMany({
      where: { email: { startsWith: 'test.participant' } }
    })
  })

  describe('POST /api/admin/participants', () => {
    it('should create a new participant successfully', async () => {
      const response = await supertest(web).post('/api/admin/participants').set('Authorization', `Bearer ${adminToken}`).send({
        name: 'Test Participant',
        email: 'test.participant@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        roleId: staffRole.id,
        unitId: ubcUnit.id
      })

      logger.debug('POST /api/admin/participants (success): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(201)
      expect(response.body.data.name).toBe('Test Participant')
      expect(response.body.data.email).toBe('test.participant@example.com')
    })

    it('should fail with 400 if email already exists', async () => {
      // Buat user pertama
      await UserTest.createUserByRole({
        name: 'Existing User',
        email: 'test.participant.duplicate@example.com',
        roleName: 'Staff',
        unitCode: 'UBC'
      })

      // Coba buat user dengan email yang sama
      const response = await supertest(web).post('/api/admin/participants').set('Authorization', `Bearer ${adminToken}`).send({
        name: 'New User Fail',
        email: 'test.participant.duplicate@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        roleId: staffRole.id,
        unitId: ubcUnit.id
      })

      logger.debug('POST /api/admin/participants (duplicate email): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(400)
      expect(response.body.errors).toBe('Email sudah terdaftar')
    })

    it('should fail with 400 if password confirmation does not match', async () => {
      const response = await supertest(web).post('/api/admin/participants').set('Authorization', `Bearer ${adminToken}`).send({
        name: 'Test Participant',
        email: 'test.participant.pwfail@example.com',
        password: 'Password123',
        confirmPassword: 'WrongPassword123',
        roleId: staffRole.id,
        unitId: ubcUnit.id
      })

      logger.debug('POST /api/admin/participants (password mismatch): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(400)
    })
  })

  describe('GET /api/admin/participants', () => {
    beforeEach(async () => {
      await UserTest.createUserByRole({ email: 'test.participant.a@example.com', name: 'Participant A', roleName: 'Staff', unitCode: 'UBC' })
      await UserTest.createUserByRole({ email: 'test.participant.b@example.com', name: 'Participant B', roleName: 'GM', unitCode: 'HO' })
    })

    it('should get a paginated list of participants', async () => {
      const response = await supertest(web).get('/api/admin/participants?page=1&limit=1').set('Authorization', `Bearer ${adminToken}`)

      logger.debug('GET /api/admin/participants (paginated): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.users).toHaveLength(1)
    })

    it('should filter participants by search query (name)', async () => {
      const response = await supertest(web).get('/api/admin/participants?search=Participant A').set('Authorization', `Bearer ${adminToken}`)

      logger.debug('GET /api/admin/participants (search name): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.users).toHaveLength(1)
      expect(response.body.data.users[0].name).toBe('Participant A')
    })

    it('should filter participants by roleId', async () => {
      const gmRole = await prismaClient.role.findUnique({ where: { name: 'GM' } })
      const response = await supertest(web).get(`/api/admin/participants?roleId=${gmRole!.id}`).set('Authorization', `Bearer ${adminToken}`)

      logger.debug('GET /api/admin/participants (filter role): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.users).toHaveLength(1)
      expect(response.body.data.users[0].role.name).toBe('GM')
    })
  })

  describe('GET /api/admin/participants/:participantId', () => {
    it('should get a single participant by ID', async () => {
      const newUser = await UserTest.createUserByRole({
        email: 'test.participant.detail@example.com',
        name: 'Detail User',
        roleName: 'Staff',
        unitCode: 'UBC'
      })

      const response = await supertest(web).get(`/api/admin/participants/${newUser.id}`).set('Authorization', `Bearer ${adminToken}`)

      logger.debug('GET /api/admin/participants/:id (success): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.name).toBe('Detail User')
    })
  })

  describe('PATCH /api/admin/participants/:participantId', () => {
    it('should update a participant successfully', async () => {
      const userToUpdate = await UserTest.createUserByRole({
        email: 'test.participant.update@example.com',
        name: 'User Lama',
        roleName: 'Staff',
        unitCode: 'UBC'
      })
      const gmRole = await prismaClient.role.findUnique({ where: { name: 'GM' } })

      const response = await supertest(web).patch(`/api/admin/participants/${userToUpdate.id}`).set('Authorization', `Bearer ${adminToken}`).send({
        name: 'User Baru Terupdate',
        roleId: gmRole!.id
      })

      logger.debug('PATCH /api/admin/participants/:id (success): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.name).toBe('User Baru Terupdate')
      expect(response.body.data.role.name).toBe('GM')
    })
  })

  describe('DELETE /api/admin/participants/:participantId', () => {
    it('should delete a participant successfully', async () => {
      const userToDelete = await UserTest.createUserByRole({
        email: 'test.participant.delete@example.com',
        name: 'User Dihapus',
        roleName: 'Staff',
        unitCode: 'UBC'
      })

      const response = await supertest(web).delete(`/api/admin/participants/${userToDelete.id}`).set('Authorization', `Bearer ${adminToken}`)

      logger.debug('DELETE /api/admin/participants/:id (success): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data.name).toBe('User Dihapus')

      // Verifikasi dari database
      const findUser = await prismaClient.user.findUnique({ where: { id: userToDelete.id } })
      expect(findUser).toBeNull()
    })

    it('should fail with 404 if participant to delete is not found', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await supertest(web).delete(`/api/admin/participants/${nonExistentId}`).set('Authorization', `Bearer ${adminToken}`)

      logger.debug('DELETE /api/admin/participants/:id (not found): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(404)
      expect(response.body.errors).toBe('User tidak ditemukan')
    })
  })
})
