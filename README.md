# Backend E-Procurement BMU

Layanan REST API untuk aplikasi E-Procurement BMU (Express + TypeScript + Prisma MariaDB). Mendukung SSO portal, manajemen master data (unit, role, user), serta alur persetujuan pengadaan.

## Prasyarat

- Node.js 18+
- Database MariaDB/MySQL
- File `.env` di root `BE/`

Contoh `.env` minimal:

```env
PORT=4000
DATABASE_URL=mysql://user:password@localhost:3306/eproc
ACCESS_TOKEN_SECRET=change-me
CLIENT_ID=portal-client-id
CLIENT_SECRET=portal-client-secret
PORTAL_API_URL=https://portal.bmuconnect.id   # gunakan mock/stub bila portal tidak bisa diakses dari lokal
FRONTEND_URL=http://localhost:3000
COOKIE_DOMAIN=localhost
CSRF_ENABLED=false
```

## Menjalankan

```bash
npm install
npm run dev      # hot reload
npm run build    # transpile ke dist
npm start        # jalankan build
```

## Database & Prisma

- `npm run prisma:migrate` — jalankan migrasi
- `npm run prisma:generate` — generate client
- `npm run seed` — isi role/unit/division/admin awal (lihat `prisma/unit_role_seeds.js`)

## Swagger API Docs

Swagger tersedia di:

- UI: `http://localhost:4000/api/docs`
- JSON: `http://localhost:4000/api/docs.json`

Dokumen mencakup endpoint SSO, refresh/logout, master data unit, dan pengadaan.

## Pengujian

```bash
npm test
npm run test:watch
```

Catatan:

- Tes menggunakan database nyata; pastikan `DATABASE_URL` mengarah ke instance dev/test terisolasi.
- Beberapa tes (mis. auth) memaketkan seed minimal (role/unit/division) langsung di file test.

## Struktur Direktori Ringkas

- src/application — bootstrap Express, koneksi Prisma
- src/routes — grouping publik (`/api/auth`, progress) dan privat (`/api/admin/*`)
- src/controller — handler per domain
- src/services — logika bisnis & validasi
- src/middleware — auth, error, upload
- src/models & src/validation — DTO, mapper, skema Zod
- src/docs — definisi Swagger
- test — suite Jest + Supertest

## Alur Autentikasi Singkat

1. FE menerima `code` dari portal, kirim ke `POST /api/auth/sso/callback`.
2. Backend memanggil portal, membuat/menyinkronkan user lokal, mengeluarkan `accessToken` (Bearer) dan `refresh_token` (cookie httpOnly).
3. `POST /api/auth/refresh` memutar refresh token dan mengembalikan access token baru.
4. `DELETE /api/auth/logout` mencabut refresh token dan membersihkan cookie.
