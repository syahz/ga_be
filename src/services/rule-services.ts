import { prismaClient } from '../application/database'
import { Validation } from '../validation/Validation'
import { ResponseError } from '../error/response-error'
import { RuleValidation } from '../validation/rule-validation' // Pastikan ini divalidasi juga
import {
  CreateRuleRequest,
  UpdateRuleRequest,
  toAllRulesResponse,
  RuleWithStepsResponse,
  UpdateRuleStepsRequest,
  toRuleWithStepsResponse
} from '../models/rule-model'

/**
 * GET ALL RULE: Mengambil semua aturan beserta langkah-langkahnya.
 */
export const getRules = async (page: number, limit: number, search: string) => {
  const skip = (page - 1) * limit
  const where = search ? { name: { contains: search } } : {}

  const [total, rules] = await prismaClient.$transaction([
    prismaClient.procurementRule.count({ where }),
    prismaClient.procurementRule.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        steps: {
          include: { role: true }
        }
      }
    })
  ])

  return toAllRulesResponse(rules, total, page, limit)
}

/**
 * GET RULE BY ID: Mengambil detail satu aturan berdasarkan ID.
 */
export const getRuleById = async (ruleId: string): Promise<RuleWithStepsResponse> => {
  const rule = await prismaClient.procurementRule.findUnique({
    where: { id: ruleId },
    include: {
      steps: {
        include: { role: true },
        orderBy: { stepOrder: 'asc' }
      }
    }
  })

  if (!rule) {
    throw new ResponseError(404, 'Aturan tidak ditemukan')
  }

  return toRuleWithStepsResponse(rule)
}

/**
 * CREATE RULE: Membuat aturan baru beserta 3 langkahnya dalam satu transaksi.
 */
export const createRule = async (request: CreateRuleRequest): Promise<RuleWithStepsResponse> => {
  // Anda perlu membuat validasi Zod baru untuk CreateRuleRequest
  const createRequest = Validation.validate(RuleValidation.CREATE, request)

  const newRuleWithSteps = await prismaClient.$transaction(async (tx) => {
    const newRule = await tx.procurementRule.create({
      data: {
        name: createRequest.name,
        minAmount: BigInt(createRequest.minAmount),
        maxAmount: createRequest.maxAmount ? BigInt(createRequest.maxAmount) : null
      }
    })

    await tx.procurementStep.createMany({
      data: createRequest.steps.map((step) => ({
        stepOrder: step.stepOrder,
        roleId: step.roleId,
        divisionId: step.divisionId,
        stepType: step.stepType,
        ruleId: newRule.id
      }))
    })

    // Ambil kembali data lengkap untuk response
    return tx.procurementRule.findUniqueOrThrow({
      where: { id: newRule.id },
      include: { steps: { include: { role: true } } }
    })
  })

  return toRuleWithStepsResponse(newRuleWithSteps)
}

/**
 * UPDATE RULE: Memperbarui detail utama dari sebuah aturan.
 */
export const updateRuleDetails = async (ruleId: string, request: UpdateRuleRequest): Promise<RuleWithStepsResponse> => {
  const updateRequest = Validation.validate(RuleValidation.UPDATE_RULE, request) // Validasi Zod baru

  const updatedRule = await prismaClient.procurementRule.update({
    where: { id: ruleId },
    data: {
      name: updateRequest.name,
      minAmount: updateRequest.minAmount ? BigInt(updateRequest.minAmount) : undefined,
      maxAmount: updateRequest.maxAmount ? BigInt(updateRequest.maxAmount) : updateRequest.maxAmount === null ? null : undefined
    },
    include: { steps: { include: { role: true } } }
  })

  return toRuleWithStepsResponse(updatedRule)
}

/**
 * UPDATE STEP: Memperbarui satu langkah spesifik di dalam aturan.
 */
export const updateRuleSteps = async (ruleId: string, request: UpdateRuleStepsRequest): Promise<RuleWithStepsResponse> => {
  const updateRequest = Validation.validate(RuleValidation.UPDATE_STEPS, request)

  const updatedRule = await prismaClient.$transaction(async (tx) => {
    // Jalankan semua promise update secara paralel
    await Promise.all(
      updateRequest.steps.map((step) =>
        // Menggunakan updateMany, tetapi karena where clause-nya spesifik,
        // ini efektif hanya akan mengupdate satu record yang cocok.
        tx.procurementStep.updateMany({
          // --- PERUBAHAN DI SINI ---
          // Kita tidak lagi menggunakan format ruleId_stepOrder,
          // melainkan where clause biasa yang mencari kombinasi keduanya.
          where: {
            ruleId: ruleId,
            stepOrder: step.stepOrder
          },
          // --------------------------
          data: {
            roleId: step.roleId,
            divisionId: (step as any).divisionId
          }
        })
      )
    )

    // Ambil kembali data aturan yang sudah lengkap untuk respons (tidak berubah)
    return tx.procurementRule.findUniqueOrThrow({
      where: { id: ruleId },
      include: { steps: { include: { role: true }, orderBy: { stepOrder: 'asc' } } }
    })
  })

  return toRuleWithStepsResponse(updatedRule)
}

/**
 * DELETE RULE: Menghapus aturan beserta semua langkah-langkahnya.
 */
export const deleteRule = async (ruleId: string): Promise<{ message: string }> => {
  // Cek dulu apakah rule ada
  const rule = await prismaClient.procurementRule.findUnique({ where: { id: ruleId } })
  if (!rule) {
    throw new ResponseError(404, 'Aturan tidak ditemukan')
  }

  await prismaClient.$transaction(async (tx) => {
    // 1. Hapus semua steps yang terhubung
    await tx.procurementStep.deleteMany({ where: { ruleId: ruleId } })
    // 2. Hapus rule itu sendiri
    await tx.procurementRule.delete({ where: { id: ruleId } })
  })

  return { message: 'Aturan berhasil dihapus' }
}
