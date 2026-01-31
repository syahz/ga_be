import swaggerJSDoc from 'swagger-jsdoc'

const swaggerDefinition: swaggerJSDoc.Options['definition'] = {
  openapi: '3.0.3',
  info: {
    title: 'E-Procurement BMU API',
    version: '1.0.0',
    description:
      'Dokumentasi REST API backend E-Procurement BMU. Semua endpoint menggunakan JSON dan sebagian besar endpoint admin membutuhkan bearer access token.',
    contact: {
      name: 'BMU IT Team'
    }
  },
  servers: [
    {
      url: process.env.BASE_URL || 'http://localhost:4000',
      description: 'Server utama / local dev'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string' },
          unit: { type: 'string' },
          division: { type: 'string' }
        }
      },
      AuthResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', description: 'JWT access token untuk Authorization header' },
          user: { $ref: '#/components/schemas/User' }
        }
      },
      ApiError: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          errors: { type: 'string' }
        }
      }
    }
  }
}

export const swaggerSpec = swaggerJSDoc({
  definition: swaggerDefinition,
  apis: []
})

export const swaggerTags = {
  auth: 'Authentication',
  procurement: 'Procurement',
  master: 'Master Data'
} as const

export const swaggerPaths: Record<string, any> = {
  '/api/auth/sso/callback': {
    post: {
      tags: [swaggerTags.auth],
      summary: 'SSO login dari portal eksternal',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                code: { type: 'string', description: 'Kode SSO callback dari portal' }
              },
              required: ['code']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Login berhasil. Refresh token diset ke cookie httpOnly.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/AuthResponse' }
                }
              }
            }
          }
        },
        400: { description: 'Data master tidak lengkap (role/unit/division tidak ditemukan)' },
        500: { description: 'Gagal menghubungi portal SSO' }
      }
    }
  },
  '/api/auth/refresh': {
    post: {
      tags: [swaggerTags.auth],
      summary: 'Rotasi refresh token dan dapatkan access token baru',
      security: [],
      responses: {
        200: {
          description: 'Berhasil mendapatkan access token baru',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  accessToken: { type: 'string' },
                  user: { $ref: '#/components/schemas/User' }
                }
              }
            }
          }
        },
        400: {
          description: 'Refresh token tidak valid atau kedaluwarsa',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        }
      }
    }
  },
  '/api/auth/logout': {
    delete: {
      tags: [swaggerTags.auth],
      summary: 'Logout dan revoke refresh token',
      security: [],
      responses: {
        200: {
          description: 'Logout berhasil. Semua cookie dibersihkan.',
          content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } } } }
        }
      }
    }
  },
  '/api/admin/units': {
    get: {
      tags: [swaggerTags.master],
      summary: 'Daftar unit (paginated)',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 10 } },
        { name: 'search', in: 'query', required: false, schema: { type: 'string' } }
      ],
      responses: { 200: { description: 'Berhasil' }, 401: { description: 'Unauthorized' } }
    },
    post: {
      tags: [swaggerTags.master],
      summary: 'Tambah unit',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { code: { type: 'string' }, name: { type: 'string' } },
              required: ['code', 'name']
            }
          }
        }
      },
      responses: { 201: { description: 'Unit dibuat' }, 409: { description: 'Kode/Nama sudah ada' }, 401: { description: 'Unauthorized' } }
    }
  },
  '/api/admin/units/all': {
    get: {
      tags: [swaggerTags.master],
      summary: 'Daftar seluruh unit (tanpa paging)',
      security: [{ bearerAuth: [] }],
      responses: { 200: { description: 'Berhasil' }, 401: { description: 'Unauthorized' } }
    }
  },
  '/api/admin/procurements': {
    get: {
      tags: [swaggerTags.procurement],
      summary: 'Daftar surat pengadaan untuk approver terkait',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
        { name: 'search', in: 'query', schema: { type: 'string' } }
      ],
      responses: { 200: { description: 'Berhasil' }, 401: { description: 'Unauthorized' } }
    },
    post: {
      tags: [swaggerTags.procurement],
      summary: 'Buat surat pengadaan baru',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                letterNumber: { type: 'string' },
                letterAbout: { type: 'string' },
                nominal: { type: 'number' },
                incomingLetterDate: { type: 'string', format: 'date-time' },
                unitId: { type: 'string' },
                note: { type: 'string' }
              },
              required: ['letterNumber', 'letterAbout', 'nominal', 'incomingLetterDate', 'unitId']
            }
          }
        }
      },
      responses: {
        201: { description: 'Surat dibuat dan diarahkan ke approver pertama' },
        403: { description: 'Role tidak berwenang' },
        409: { description: 'Nomor surat sudah dipakai' }
      }
    }
  },
  '/api/admin/procurements/decision/{letterId}': {
    post: {
      tags: [swaggerTags.procurement],
      summary: 'Ambil keputusan pada surat pengadaan',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'letterId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                decision: { type: 'string', enum: ['APPROVE', 'REJECT', 'REQUEST_REVISION'] },
                comment: { type: 'string' }
              },
              required: ['decision']
            }
          }
        }
      },
      responses: {
        200: { description: 'Status surat diperbarui' },
        403: { description: 'Tidak berwenang' },
        404: { description: 'Surat tidak ditemukan' }
      }
    }
  }
}

swaggerDefinition.paths = swaggerPaths

export default swaggerSpec
