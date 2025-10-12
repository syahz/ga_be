import { z } from 'zod'
import { StepType } from '@prisma/client'

export class RuleValidation {
  /**
   * Skema validasi untuk satu objek 'step' yang akan digunakan di dalam skema utama.
   * Ini tidak diekspor karena hanya digunakan secara internal.
   */
  private static readonly STEP_SCHEMA = z.object({
    stepOrder: z.number().int().min(1),
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
        .length(3, 'Harus ada tepat 3 langkah persetujuan (CREATE, REVIEW, APPROVE)')
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
        .refine(
          (steps) => {
            // Validasi: Pastikan urutan dan tipe langkah benar
            const hasCreate = steps.some((s) => s.stepOrder === 1 && s.stepType === 'CREATE')
            const hasReview = steps.some((s) => s.stepOrder === 2 && s.stepType === 'REVIEW')
            const hasApprove = steps.some((s) => s.stepOrder === 3 && s.stepType === 'APPROVE')
            return hasCreate && hasReview && hasApprove
          },
          {
            message: 'Struktur langkah tidak valid. Harus ada CREATE (order 1), REVIEW (order 2), dan APPROVE (order 3).'
          }
        )
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
          stepOrder: z.number().int().min(1).max(3),
          roleId: z.string().uuid({ message: 'Format Role ID tidak valid.' })
        })
      )
      .length(3, 'Harus ada tepat 3 langkah persetujuan.')
      .refine(
        (steps) => {
          // Validasi: Pastikan roleId unik untuk setiap langkah
          const roleIds = new Set(steps.map((s) => s.roleId))
          return roleIds.size === 3
        },
        {
          message: 'Setiap langkah harus memiliki Role yang berbeda.'
        }
      )
  })
}
