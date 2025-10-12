import supertest from 'supertest'
import { web } from '../src/application/web'
import { logger } from '../src/utils/logger'
import { UserTest, UserWithRole } from './utils/test-utils'
import { prismaClient } from '../src/application/database'
import { hashToken } from '../src/utils/token'

describe('Auth API (/api/auth)', () => {
  let testUser: UserWithRole

  // Buat satu user untuk tes sebelum semua tes berjalan
  beforeAll(async () => {
    testUser = await UserTest.createUserByRole({
      email: 'test.auth.user@example.com',
      name: 'Auth Test User',
      roleName: 'Staff',
      unitCode: 'UBC'
    })
  })

  // Hapus user dan refresh token setelah semua tes selesai
  afterAll(async () => {
    await UserTest.delete()
  })

  // Hapus refresh token setelah setiap tes untuk isolasi
  afterEach(async () => {
    await prismaClient.refreshToken.deleteMany({
      where: { userId: testUser.id }
    })
  })

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const response = await supertest(web).post('/api/auth/login').send({
        email: testUser.email,
        password: 'password123'
      })

      logger.debug('POST /api/auth/login (success): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('accessToken')
      expect(response.body.user.email).toBe(testUser.email)

      // Verifikasi bahwa cookie di-set
      const cookies = response.get('Set-Cookie')
      expect((cookies ?? []).some((cookie) => cookie.startsWith('refresh_token='))).toBe(true)
      expect((cookies ?? []).some((cookie) => cookie.startsWith('user_role=Staff'))).toBe(true)
      expect((cookies ?? []).some((cookie) => cookie.startsWith('user_unit=UB%20Coffee'))).toBe(true)
    })

    it('should fail with 401 for incorrect password', async () => {
      const response = await supertest(web).post('/api/auth/login').send({
        email: testUser.email,
        password: 'wrongpassword'
      })

      logger.debug('POST /api/auth/login (wrong password): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Invalid credentials')
    })

    it('should fail with 401 for non-existent user', async () => {
      const response = await supertest(web).post('/api/auth/login').send({
        email: 'not.exist@example.com',
        password: 'password123'
      })

      logger.debug('POST /api/auth/login (not found): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Invalid credentials')
    })
  })

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string

    beforeEach(async () => {
      // Lakukan login untuk mendapatkan refresh token yang valid
      const loginResponse = await supertest(web).post('/api/auth/login').send({
        email: testUser.email,
        password: 'password123'
      })

      // Ekstrak refresh token dari cookie
      const cookie = loginResponse.get('Set-Cookie')?.find((c) => c.startsWith('refresh_token=')) ?? ''
      refreshToken = cookie!.split(';')[0].split('=')[1]
    })

    it('should refresh the access token successfully with a valid refresh token', async () => {
      const response = await supertest(web).post('/api/auth/refresh').set('Cookie', `refresh_token=${refreshToken}`)

      logger.debug('POST /api/auth/refresh (success): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('accessToken')
      expect(response.body.user.id).toBe(testUser.id)

      // Pastikan cookie baru di-set
      const newCookies = response.get('Set-Cookie')
      expect((newCookies ?? []).some((cookie) => cookie.startsWith('refresh_token='))).toBe(true)
    })

    it('should fail with 401 if refresh token is missing', async () => {
      const response = await supertest(web).post('/api/auth/refresh')

      logger.debug('POST /api/auth/refresh (no token): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(401)
      expect(response.body.error).toBe('No refresh token')
    })

    it('should fail with 401 if refresh token is invalid', async () => {
      const response = await supertest(web).post('/api/auth/refresh').set('Cookie', 'refresh_token=invalidtoken123')

      logger.debug('POST /api/auth/refresh (invalid token): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Invalid refresh token')
    })
  })

  describe('DELETE /api/auth/logout', () => {
    it('should logout successfully and clear cookies', async () => {
      // Login dulu untuk mendapatkan token
      const loginResponse = await supertest(web).post('/api/auth/login').send({
        email: testUser.email,
        password: 'password123'
      })
      const cookie = loginResponse.get('Set-Cookie')?.find((c) => c.startsWith('refresh_token='))
      const refreshToken = cookie!.split(';')[0].split('=')[1]

      const response = await supertest(web).delete('/api/auth/logout').set('Cookie', `refresh_token=${refreshToken}`)

      logger.debug('DELETE /api/auth/logout (success): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.ok).toBe(true)

      // Verifikasi bahwa token di database sudah di-revoke
      const tokenHash = hashToken(refreshToken)
      const storedToken = await prismaClient.refreshToken.findUnique({ where: { tokenHash } })
      expect(storedToken?.revoked).toBe(true)

      // Verifikasi bahwa cookie diinstruksikan untuk dihapus
      const clearedCookies = response.get('Set-Cookie')
      expect((clearedCookies ?? []).every((c) => c.includes('Max-Age=0') || c.includes('Expires=Thu, 01 Jan 1970'))).toBe(true)
    })
  })
})
