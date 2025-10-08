import { z } from 'zod'

// Definisi skema password kompleks (untuk konsistensi)
const ComplexPasswordSchema = z
  .string()
  .min(8, 'Password harus memiliki minimal 8 karakter')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d,.\?\/;'[\]\$%^&*()!@#]+$/, 'Password harus mengandung huruf kecil, huruf besar, dan angka')
  .refine((value) => !/\s/.test(value), {
    message: 'Password tidak boleh mengandung spasi'
  })

export class ParticipantValidation {
  static readonly CREATE = z
    .object({
      name: z.string().min(1, 'Nama wajib diisi'),
      email: z.string().email('Format email tidak valid'),
      // Gunakan skema kompleks
      password: ComplexPasswordSchema,
      confirmPassword: z.string(),
      unitId: z.string().uuid('Unit Id tidak valid'),
      roleId: z.string().uuid('Role Id tidak valid')
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Konfirmasi password harus sesuai dengan password',
      path: ['confirmPassword']
    })

  static readonly UPDATE = z
    .object({
      name: z.string().min(1, 'Nama tidak boleh kosong').max(100).optional(),
      email: z.email('Format email tidak valid').optional(),
      roleId: z.uuid('Format Role ID tidak valid (UUID)').optional(),
      unitId: z.uuid('Format Unit ID tidak valid (UUID)').optional(),

      // 🔑 PERBAIKAN 1: Mengizinkan string kosong atau password kompleks
      password: z.union([z.literal(''), ComplexPasswordSchema]).optional(),

      // confirmPassword harus string, tetapi tidak perlu min(8) lagi
      confirmPassword: z.string().optional()
    })
    .refine(
      (data) => {
        // 🔑 PERBAIKAN 2: Hanya jalankan validasi kecocokan jika password diisi
        // Cek jika password ada DAN panjangnya > 0 (menghindari string kosong)
        if (data.password && data.password.length > 0) {
          return data.password === data.confirmPassword
        }
        return true // Lolos jika password kosong
      },
      {
        message: 'Password dan konfirmasi password tidak cocok',
        path: ['confirmPassword']
      }
    )
}
