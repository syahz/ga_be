import { z } from 'zod'

export class UserValidation {
  static readonly REGISTER = z.object({
    email: z.string().email().min(5).max(100),
    password: z.string().min(1).max(100),
    name: z.string().min(1).max(100)
  })

  static readonly UPDATEACCOUNT = z.object({
    name: z.string().max(100).optional(),
    email: z.string().email().max(100).optional()
  })

  static readonly UPDATEAUDITOR = z.object({
    registration_number: z.string().min(1, 'Nomor registrasi wajib diisi'),
    phone_number: z.string().min(8, 'Nomor telepon minimal 8 digit'),
    jenis_kelamin: z.enum(['L', 'P']),
    pendidikan: z.enum(['S1', 'S2', 'S3'])
  })

  static readonly UPDATEPASSWORD = z
    .object({
      current_password: z.string().min(1),
      new_password: z
        .string()
        .min(8, 'Password harus memiliki minimal 8 karakter')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d,.\?\/;'[\]\$%^&*()!@#]+$/, 'Password harus mengandung huruf kecil, huruf besar, dan angka')
        .refine((value) => !/\s/.test(value), {
          message: 'Password tidak boleh mengandung spasi'
        }),
      confirm_password: z.string()
    })
    .refine((data) => data.new_password === data.confirm_password, {
      message: 'Konfirmasi password harus sesuai dengan password',
      path: ['confirmPassword']
    })
}
