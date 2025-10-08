// src/services/procurement-services.ts

import { prismaClient } from '../application/database'
import { ResponseError } from '../error/response-error'
import { CreateProcurementRequestDto, ProcessDecisionRequestDto, toAllProcurementLettersResponse } from '../models/procurement-model'
import { UserWithRelations } from '../type/user-request'
import { ProcurementValidation } from '../validation/procurement-validation'
import { Validation } from '../validation/Validation'

// --- Helper & Config (Tidak berubah) ---
const HEAD_OFFICE_ROLES = ['Direktur Keuangan', 'Direktur Operasional', 'Direktur Utama', 'Kadiv Keuangan', 'General Affair']
const HEAD_OFFICE_CODE = 'HO'

// --- Service Functions ---

/**
 * Membuat surat pengadaan baru menggunakan model ProcurementRule dan ProcurementStep.
 */
export const createProcurementLetter = async (request: CreateProcurementRequestDto, user: UserWithRelations) => {
  const createRequest = Validation.validate(ProcurementValidation.CREATE, request)
  const nominal = BigInt(createRequest.nominal)

  const creator = await prismaClient.user.findUnique({
    where: { id: user.id },
    include: { role: true, unit: true }
  })
  if (!creator) {
    throw new ResponseError(404, 'User not found')
  }

  // 1. Ambil aturan yang sesuai dengan nominal
  const rule = await prismaClient.procurementRule.findFirst({
    where: {
      minAmount: { lte: nominal },
      OR: [{ maxAmount: { gte: nominal } }, { maxAmount: null }]
    },
    include: {
      // Sertakan semua langkah yang terkait dengan aturan ini, diurutkan
      steps: {
        orderBy: { stepOrder: 'asc' },
        include: { role: true }
      }
    }
  })

  if (!rule || rule.steps.length < 2) {
    // Minimal harus ada 1 langkah CREATE dan 1 langkah REVIEW/APPROVE
    throw new ResponseError(500, 'Aturan pengadaan untuk nominal ini tidak lengkap atau tidak ditemukan. Minimal harus ada 2 langkah.')
  }
  const ruleSteps = rule.steps

  // 2. Validasi Creator: Cek langkah pertama (stepOrder: 1)
  const creatorStep = ruleSteps[0]
  if (creatorStep.stepType !== 'CREATE' || creator.roleId !== creatorStep.roleId) {
    throw new ResponseError(403, `Role '${creator.role.name}' tidak berwenang membuat pengadaan senilai ini.`)
  }

  // 3. Tentukan Approver Berikutnya: Ambil langkah kedua (stepOrder: 2)
  const firstApproverStep = ruleSteps[1]
  const nextApproverRole = firstApproverStep.role

  const headOfficeUnit = await prismaClient.unit.findUnique({ where: { code: HEAD_OFFICE_CODE } })
  if (!headOfficeUnit) {
    throw new ResponseError(500, 'Unit Head Office tidak ditemukan')
  }

  const nextApprover = await prismaClient.user.findFirst({
    where: HEAD_OFFICE_ROLES.includes(nextApproverRole.name)
      ? { roleId: nextApproverRole.id, unitId: headOfficeUnit.id }
      : { roleId: nextApproverRole.id, unitId: creator.unitId }
  })
  if (!nextApprover) {
    throw new ResponseError(404, `Approver dengan role '${nextApproverRole.name}' tidak ditemukan.`)
  }

  // 4. Buat surat dan log dalam satu transaksi
  return prismaClient.$transaction(async (tx) => {
    const newLetter = await tx.procurementLetter.create({
      data: {
        ...createRequest,
        incomingLetterDate: new Date(createRequest.incomingLetterDate),
        nominal,
        status: 'PENDING_REVIEW',
        unitId: creator.unitId,
        createdById: creator.id,
        currentApproverId: nextApprover.id
      }
    })
    await tx.procurementLog.create({
      data: { procurementLetterId: newLetter.id, actorId: creator.id, action: 'CREATED', comment: 'Surat pengadaan dibuat.' }
    })
    return newLetter
  })
}

/**
 * Mengambil daftar surat untuk dashboard user (Logika tidak berubah).
 */
export const getDashboardLetters = async (user: UserWithRelations, page: number, limit: number, search: string) => {
  // ... (Tidak ada perubahan di fungsi ini)
  const skip = (page - 1) * limit

  const baseWhere = {
    OR: [{ currentApproverId: user.id }, { createdById: user.id, status: 'NEEDS_REVISION' as const }]
  }

  let searchFilter = {}
  if (search) {
    const isNumeric = !isNaN(parseFloat(search)) && isFinite(Number(search))
    searchFilter = {
      OR: [
        { letterNumber: { contains: search, mode: 'insensitive' } },
        { letterAbout: { contains: search, mode: 'insensitive' } },
        ...(isNumeric ? [{ nominal: { equals: BigInt(search) } }] : [])
      ]
    }
  }

  const where = {
    ...baseWhere,
    ...(search && { AND: [searchFilter] })
  }

  const [totalLetters, letters] = await prismaClient.$transaction([
    prismaClient.procurementLetter.count({ where }),
    prismaClient.procurementLetter.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        currentApprover: { select: { name: true } },
        unit: { select: { name: true } }
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    })
  ])

  return toAllProcurementLettersResponse(letters, totalLetters, page, limit)
}

/**
 * Memproses keputusan (Setuju/Tolak/Revisi) menggunakan model ProcurementRule dan ProcurementStep.
 */
export const processDecisionLetter = async (letterId: string, request: ProcessDecisionRequestDto, user: UserWithRelations) => {
  const decisionRequest = Validation.validate(ProcurementValidation.PROCESS_DECISION, request)
  const { decision, comment } = decisionRequest

  const approverUser = await prismaClient.user.findUnique({ where: { id: user.id }, include: { role: true } })
  if (!approverUser) throw new ResponseError(404, 'Approver user not found')

  const letter = await prismaClient.procurementLetter.findUnique({ where: { id: letterId } })
  if (!letter) throw new ResponseError(404, 'Procurement letter not found.')
  if (letter.currentApproverId !== approverUser.id) throw new ResponseError(403, 'You are not authorized to process this letter.')

  // Handle Tolak atau Minta Revisi (Logika tidak berubah signifikan)
  if (decision === 'REJECT' || decision === 'REQUEST_REVISION') {
    const finalStatus = decision === 'REJECT' ? 'REJECTED' : 'NEEDS_REVISION'
    const logAction = decision === 'REJECT' ? 'REJECTED' : 'REVISION_REQUESTED'
    const nextApproverId = decision === 'REJECT' ? null : letter.createdById

    return prismaClient.$transaction(async (tx) => {
      const updatedLetter = await tx.procurementLetter.update({
        where: { id: letterId },
        data: { status: finalStatus, currentApproverId: nextApproverId }
      })
      await tx.procurementLog.create({ data: { procurementLetterId: letterId, actorId: approverUser.id, action: logAction, comment } })
      return updatedLetter
    })
  }

  // Handle 'APPROVE'
  const rule = await prismaClient.procurementRule.findFirst({
    where: {
      minAmount: { lte: letter.nominal },
      OR: [{ maxAmount: { gte: letter.nominal } }, { maxAmount: null }]
    },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
        include: { role: true }
      }
    }
  })

  if (!rule || rule.steps.length === 0) throw new ResponseError(500, 'Configuration error: Approval rule not found.')
  const ruleSteps = rule.steps

  const currentStep = ruleSteps.find((step) => step.roleId === approverUser.role.id)
  if (!currentStep) throw new ResponseError(403, 'Your role is not part of this approval chain.')

  const isFinalStep = currentStep.stepOrder === ruleSteps[ruleSteps.length - 1].stepOrder

  if (isFinalStep) {
    // Jika ini adalah langkah terakhir, setujui surat
    return prismaClient.$transaction(async (tx) => {
      const updatedLetter = await tx.procurementLetter.update({ where: { id: letterId }, data: { status: 'APPROVED', currentApproverId: null } })
      await tx.procurementLog.create({ data: { procurementLetterId: letterId, actorId: approverUser.id, action: 'APPROVED', comment } })
      return updatedLetter
    })
  } else {
    // Jika bukan langkah terakhir, teruskan ke approver berikutnya
    const nextStep = ruleSteps.find((step) => step.stepOrder === currentStep.stepOrder + 1)
    if (!nextStep) throw new ResponseError(500, 'Configuration error: Next approval step not found.')

    const headOfficeUnit = await prismaClient.unit.findUnique({ where: { code: HEAD_OFFICE_CODE } })
    if (!headOfficeUnit) throw new ResponseError(500, 'Head Office unit not found')

    const nextApprover = await prismaClient.user.findFirst({
      where: HEAD_OFFICE_ROLES.includes(nextStep.role.name)
        ? { roleId: nextStep.role.id, unitId: headOfficeUnit.id }
        : { roleId: nextStep.role.id, unitId: letter.unitId } // Menggunakan unitId dari surat
    })
    if (!nextApprover) throw new ResponseError(404, `Next approver with role '${nextStep.role.name}' not found.`)

    return prismaClient.$transaction(async (tx) => {
      const updatedLetter = await tx.procurementLetter.update({
        where: { id: letterId },
        data: { status: 'PENDING_APPROVAL', currentApproverId: nextApprover.id }
      })
      await tx.procurementLog.create({ data: { procurementLetterId: letterId, actorId: approverUser.id, action: 'REVIEWED', comment } })
      return updatedLetter
    })
  }
}
