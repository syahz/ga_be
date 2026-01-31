import { jest, describe, it, expect, beforeAll, afterEach } from '@jest/globals'
import supertest from 'supertest'
import axios from 'axios'
import { web } from '../src/application/web'
import { logger } from '../src/utils/logger'
import { prismaClient } from '../src/application/database'
import { hashToken } from '../src/utils/token'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('Auth API (/api/auth)', () => {
  beforeAll(async () => {
    process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'your-secret-key-for-testing'
    process.env.CLIENT_ID = process.env.CLIENT_ID || 'test-client-id'
    process.env.CLIENT_SECRET = process.env.CLIENT_SECRET || 'test-client-secret'
    process.env.PORTAL_API_URL = process.env.PORTAL_API_URL || 'https://portal.bmuconnect.id'

    await prismaClient.role.upsert({ where: { name: 'Staff' }, update: {}, create: { name: 'Staff' } })
    await prismaClient.division.upsert({ where: { name: 'Finance' }, update: {}, create: { name: 'Finance' } })
    await prismaClient.unit.upsert({ where: { code: 'UBC' }, update: { name: 'UB Coffee' }, create: { code: 'UBC', name: 'UB Coffee' } })
  })

  const portalUser = {
    id: 'sso-user-1',
    email: 'sso.test.user@example.com',
    name: 'SSO Test User',
    role: 'Staff',
    unit_code: 'UBC',
    division_name: 'Finance'
  }

  const mockPortalResponse = { data: { user: portalUser, portal_refresh_expires_ts: null } }

  const extractRefreshToken = (cookies: string[] = []) =>
    cookies
      .find((c) => c.startsWith('refresh_token='))
      ?.split(';')[0]
      .split('=')[1]

  const performSsoLogin = async () => {
    mockedAxios.post.mockResolvedValueOnce(mockPortalResponse)
    return supertest(web).post('/api/auth/sso/callback').send({ code: 'valid-code' })
  }

  afterEach(async () => {
    jest.clearAllMocks()
    await prismaClient.refreshToken.deleteMany({ where: { userId: portalUser.id } })
    await prismaClient.user.deleteMany({ where: { email: portalUser.email } })
  })

  describe('POST /api/auth/sso/callback', () => {
    it('should login via SSO and set cookies', async () => {
      const response = await performSsoLogin()

      logger.debug('POST /api/auth/sso/callback (success): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('accessToken')
      expect(response.body.data.user.email).toBe(portalUser.email)

      const cookies = response.get('Set-Cookie') ?? []
      expect(cookies.some((cookie) => cookie.startsWith('refresh_token='))).toBe(true)
      expect(cookies.some((cookie) => cookie.startsWith('user_role='))).toBe(true)
      expect(cookies.some((cookie) => cookie.startsWith('user_unit='))).toBe(true)
    })

    it('should return 500 if portal rejects the code', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Invalid code'))

      const response = await supertest(web).post('/api/auth/sso/callback').send({ code: 'bad-code' })

      logger.debug('POST /api/auth/sso/callback (portal error): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(500)
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const loginResponse = await performSsoLogin()
      const refreshToken = extractRefreshToken(loginResponse.get('Set-Cookie'))

      const response = await supertest(web).post('/api/auth/refresh').set('Cookie', `refresh_token=${refreshToken}`)

      logger.debug('POST /api/auth/refresh (success): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('accessToken')
      expect(response.body.user.email).toBe(portalUser.email)

      const newCookies = response.get('Set-Cookie') ?? []
      expect(newCookies.some((cookie) => cookie.startsWith('refresh_token='))).toBe(true)
    })

    it('should fail with 401 if refresh token is missing', async () => {
      const response = await supertest(web).post('/api/auth/refresh')

      logger.debug('POST /api/auth/refresh (missing token): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(401)
      expect(response.body.error).toBe('No refresh token')
    })

    it('should fail with 401 if refresh token is invalid', async () => {
      const response = await supertest(web).post('/api/auth/refresh').set('Cookie', 'refresh_token=invalidtoken123')

      logger.debug('POST /api/auth/refresh (invalid token): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Invalid or expired refresh token')
    })
  })

  describe('DELETE /api/auth/logout', () => {
    it('should revoke refresh token and clear cookies', async () => {
      const loginResponse = await performSsoLogin()
      const refreshToken = extractRefreshToken(loginResponse.get('Set-Cookie'))!

      const response = await supertest(web).delete('/api/auth/logout').set('Cookie', `refresh_token=${refreshToken}`)

      logger.debug('DELETE /api/auth/logout (success): %s', JSON.stringify(response.body, null, 2))
      expect(response.status).toBe(200)
      expect(response.body.ok).toBe(true)

      const tokenHash = hashToken(refreshToken)
      const storedToken = await prismaClient.refreshToken.findUnique({ where: { tokenHash } })
      expect(storedToken?.revoked).toBe(true)

      const clearedCookies = response.get('Set-Cookie') ?? []
      expect(clearedCookies.every((c) => c.includes('Max-Age=0') || c.includes('Expires=Thu, 01 Jan 1970'))).toBe(true)
    })
  })
})
