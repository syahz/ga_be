import { z } from 'zod'
import { StepType } from '@prisma/client'

export class RuleValidation {
  /**
   * Skema validasi untuk satu objek 'step' yang akan digunakan di dalam skema utama.
   * Ini tidak diekspor karena hanya digunakan secara internal.
   */
  private static readonly STEP_SCHEMA = z.object({
    // FE mengizinkan stepOrder mulai dari 0 (contoh yang diberikan punya 0 di akhir)
    stepOrder: z.number().int().min(0),
    stepType: z.nativeEnum(StepType),
    roleId: z.uuid({ message: 'Format Role ID tidak valid.' })
  })

  /**
   * Skema untuk endpoint: POST /rules (CREATE RULE)
   * Memvalidasi seluruh objek aturan beserta 3 langkah wajibnya.
   */
  static readonly CREATE = z
    .object({
      name: z.string().min(3, 'Nama aturan minimal 3 karakter').max(100, 'Nama aturan maksimal 100 karakter'),
      minAmount: z.number().nonnegative('Jumlah minimal tidak boleh negatif'),
      maxAmount: z.number().nonnegative('Jumlah maksimal tidak boleh negatif').nullable().optional(),
      steps: z
        .array(this.STEP_SCHEMA)
        .min(3, 'Minimal 3 langkah persetujuan.')
        .refine((steps) => steps.filter((s) => s.stepType === 'CREATE').length === 1, {
          message: 'Harus ada tepat 1 langkah CREATE.',
          path: ['steps']
        })
        .refine((steps) => steps.some((s) => s.stepType === 'REVIEW'), { message: 'Minimal harus ada 1 langkah REVIEW.', path: ['steps'] })
        .refine((steps) => steps.some((s) => s.stepType === 'APPROVE'), { message: 'Minimal harus ada 1 langkah APPROVE.', path: ['steps'] })
    })
    .refine(
      (data) => {
        // Validasi: maxAmount tidak boleh lebih kecil dari minAmount jika ada
        if (data.maxAmount !== null && data.maxAmount !== undefined) {
          return data.maxAmount >= data.minAmount
        }
        return true
      },
      {
        message: 'Jumlah maksimal tidak boleh lebih kecil dari jumlah minimal',
        path: ['maxAmount'] // Menunjukkan error ini terkait field maxAmount
      }
    )

  /**
   * Skema untuk endpoint: PUT /rules/:ruleId (UPDATE RULE)
   * Memvalidasi pembaruan detail utama aturan. Semua field opsional.
   */
  static readonly UPDATE_RULE = z
    .object({
      name: z.string().min(3, 'Nama aturan minimal 3 karakter').max(100).optional(),
      minAmount: z.number().nonnegative('Jumlah minimal tidak boleh negatif').optional(),
      maxAmount: z.number().nonnegative('Jumlah maksimal tidak boleh negatif').nullable().optional()
    })
    .refine(
      (data) => {
        // Validasi silang hanya jika kedua field ada
        if (data.minAmount !== undefined && data.maxAmount !== undefined && data.maxAmount !== null) {
          return data.maxAmount >= data.minAmount
        }
        return true
      },
      {
        message: 'Jumlah maksimal tidak boleh lebih kecil dari jumlah minimal',
        path: ['maxAmount']
      }
    )

  /**
   * Skema untuk endpoint: PUT /rules/step/:stepId (UPDATE STEP)
   * Memvalidasi pembaruan role pada satu langkah spesifik.
   */
  static readonly UPDATE_STEPS = z.object({
    steps: z
      .array(
        z.object({
          // Kita hanya perlu roleId dan stepOrder untuk update
          stepOrder: z.number().int().min(1),
          roleId: z.string().uuid({ message: 'Format Role ID tidak valid.' })
        })
      )
      .min(1, 'Minimal harus ada 1 langkah untuk diperbarui.')
      .refine(
        (steps) => {
          // Validasi: Pastikan roleId unik untuk setiap langkah
          const roleIds = new Set(steps.map((s) => s.roleId))
          return roleIds.size === steps.length
        },
        {
          message: 'Setiap langkah harus memiliki Role yang berbeda.'
        }
      )
  })
}
