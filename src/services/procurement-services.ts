import fs from 'fs'
import path from 'path'
import {
  ProcessDecisionRequestDto,
  CreateProcurementRequestDto,
  toProcurementLetterResponse,
  toAllProcurementLettersResponse
} from '../models/procurement-model'
import { logger } from '../utils/logger'
import { Validation } from '../validation/Validation'
import { prismaClient } from '../application/database'
import { ResponseError } from '../error/response-error'
import { UserWithRelations } from '../type/user-request'
import { ProcurementValidation } from '../validation/procurement-validation'

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

  const procurementUnitId = createRequest.unitId

  const rule = await prismaClient.procurementRule.findFirst({
    where: {
      minAmount: { lte: nominal },
      OR: [{ maxAmount: { gte: nominal } }, { maxAmount: null }]
    },
    include: {
      steps: { orderBy: { stepOrder: 'asc' }, include: { role: true } }
    }
  })

  if (!rule || rule.steps.length < 2) {
    throw new ResponseError(500, 'Aturan pengadaan untuk nominal ini tidak lengkap atau tidak ditemukan.')
  }
  const ruleSteps = rule.steps

  const creatorStep = ruleSteps[0]
  if (creatorStep.stepType !== 'CREATE' || creator.roleId !== creatorStep.roleId) {
    throw new ResponseError(403, `Role '${creator.role.name}' tidak berwenang membuat pengadaan senilai ini.`)
  }

  const firstApproverStep = ruleSteps[1]
  const nextApproverRole = firstApproverStep.role

  const headOfficeUnit = await prismaClient.unit.findUnique({ where: { code: HEAD_OFFICE_CODE } })
  if (!headOfficeUnit) {
    throw new ResponseError(500, 'Unit Head Office tidak ditemukan')
  }

  // Logika Pencarian Approver yang Diperbaiki
  const nextApprover = await prismaClient.user.findFirst({
    where: HEAD_OFFICE_ROLES.includes(nextApproverRole.name)
      ? { roleId: nextApproverRole.id, unitId: headOfficeUnit.id }
      : { roleId: nextApproverRole.id, unitId: procurementUnitId }
  })

  if (!nextApprover) {
    const unitForSearch = HEAD_OFFICE_ROLES.includes(nextApproverRole.name)
      ? headOfficeUnit
      : await prismaClient.unit.findUnique({ where: { id: procurementUnitId } })
    throw new ResponseError(404, `Approver dengan role '${nextApproverRole.name}' tidak ditemukan di unit '${unitForSearch?.name}'.`)
  }

  const letterTransaction = await prismaClient.$transaction(async (tx) => {
    const newLetter = await tx.procurementLetter.create({
      data: {
        letterNumber: createRequest.letterNumber,
        letterAbout: createRequest.letterAbout,
        letterFile: createRequest.letterFile!,
        incomingLetterDate: new Date(createRequest.incomingLetterDate),
        nominal,
        status: 'PENDING_REVIEW',
        unitId: procurementUnitId,
        createdById: creator.id,
        currentApproverId: nextApprover.id
      },
      include: {
        createdBy: { select: { name: true } },
        currentApprover: { select: { name: true } },
        unit: { select: { name: true } }
      }
    })
    await tx.procurementLog.create({
      data: { procurementLetterId: newLetter.id, actorId: creator.id, action: 'CREATED', comment: 'Surat pengadaan dibuat.' }
    })
    return newLetter
  })

  // Gunakan mapper sebelum return untuk mengatasi error BigInt
  return toProcurementLetterResponse(letterTransaction)
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

  // 1. Validasi Pengguna dan Surat
  const approverUser = await prismaClient.user.findUnique({ where: { id: user.id }, include: { role: true } })
  if (!approverUser) throw new ResponseError(404, 'Approver user not found')

  const letter = await prismaClient.procurementLetter.findUnique({ where: { id: letterId } })
  if (!letter) throw new ResponseError(404, 'Procurement letter not found.')
  if (letter.currentApproverId !== approverUser.id) {
    // Log untuk debugging jika perlu
    logger.error(`Authorization failed: User ${approverUser.id} tried to process letter ${letter.id} which belongs to ${letter.currentApproverId}`)
    throw new ResponseError(403, 'You are not authorized to process this letter.')
  }

  // 2. Handle REJECT atau REQUEST_REVISION
  if (decision === 'REJECT' || decision === 'REQUEST_REVISION') {
    const finalStatus = decision === 'REJECT' ? 'REJECTED' : 'NEEDS_REVISION'
    const logAction = decision === 'REJECT' ? 'REJECTED' : 'REVISION_REQUESTED'
    const nextApproverId = decision === 'REJECT' ? null : letter.createdById

    const updatedLetter = await prismaClient.$transaction(async (tx) => {
      const updated = await tx.procurementLetter.update({
        where: { id: letterId },
        data: { status: finalStatus, currentApproverId: nextApproverId },
        include: { createdBy: { select: { name: true } }, currentApprover: { select: { name: true } }, unit: { select: { name: true } } }
      })
      await tx.procurementLog.create({ data: { procurementLetterId: letterId, actorId: approverUser.id, action: logAction, comment } })
      return updated
    })
    return toProcurementLetterResponse(updatedLetter)
  }

  // 3. Handle 'APPROVE'
  const rule = await prismaClient.procurementRule.findFirst({
    where: {
      minAmount: { lte: letter.nominal },
      OR: [{ maxAmount: { gte: letter.nominal } }, { maxAmount: null }]
    },
    include: { steps: { orderBy: { stepOrder: 'asc' }, include: { role: true } } }
  })

  if (!rule || rule.steps.length === 0) throw new ResponseError(500, 'Configuration error: Approval rule not found.')
  const ruleSteps = rule.steps

  const currentStep = ruleSteps.find((step) => step.roleId === approverUser.role.id)
  if (!currentStep) throw new ResponseError(403, 'Your role is not part of this approval chain.')

  const isFinalStep = currentStep.stepOrder === ruleSteps[ruleSteps.length - 1].stepOrder

  if (isFinalStep) {
    // A. Jika ini langkah terakhir, setujui surat
    const finalLetter = await prismaClient.$transaction(async (tx) => {
      const updated = await tx.procurementLetter.update({
        where: { id: letterId },
        data: { status: 'APPROVED', currentApproverId: null },
        include: { createdBy: { select: { name: true } }, currentApprover: { select: { name: true } }, unit: { select: { name: true } } }
      })
      await tx.procurementLog.create({ data: { procurementLetterId: letterId, actorId: approverUser.id, action: 'APPROVED', comment } })
      return updated
    })
    return toProcurementLetterResponse(finalLetter)
  } else {
    // B. Jika bukan langkah terakhir, teruskan ke approver berikutnya
    const nextStep = ruleSteps.find((step) => step.stepOrder === currentStep.stepOrder + 1)
    if (!nextStep) throw new ResponseError(500, 'Configuration error: Next approval step not found.')

    const headOfficeUnit = await prismaClient.unit.findUnique({ where: { code: HEAD_OFFICE_CODE } })
    if (!headOfficeUnit) throw new ResponseError(500, 'Head Office unit not found')

    const nextApprover = await prismaClient.user.findFirst({
      where: HEAD_OFFICE_ROLES.includes(nextStep.role.name)
        ? { roleId: nextStep.role.id, unitId: headOfficeUnit.id }
        : { roleId: nextStep.role.id, unitId: letter.unitId }
    })
    if (!nextApprover) throw new ResponseError(404, `Next approver with role '${nextStep.role.name}' not found.`)

    const forwardedLetter = await prismaClient.$transaction(async (tx) => {
      const updated = await tx.procurementLetter.update({
        where: { id: letterId },
        data: { status: 'PENDING_APPROVAL', currentApproverId: nextApprover.id },
        include: { createdBy: { select: { name: true } }, currentApprover: { select: { name: true } }, unit: { select: { name: true } } }
      })
      await tx.procurementLog.create({ data: { procurementLetterId: letterId, actorId: approverUser.id, action: 'REVIEWED', comment } })
      return updated
    })
    return toProcurementLetterResponse(forwardedLetter)
  }
}

/**
 * Mendapatkan file surat pengadaan (Logika tidak berubah).
 * File disajikan dari direktori upload.
 * Pastikan untuk mengamankan endpoint ini dengan autentikasi dan otorisasi yang sesuai.
 */

export const getProcurementLetterPath = async (fileName: string): Promise<string> => {
  // **SANGAT PENTING: Keamanan Path Traversal**
  // Pastikan fileName hanya berisi nama file, bukan path seperti '../../etc/passwd'
  // path.basename() akan mengekstrak hanya bagian nama file dari string.
  const secureFileName = path.basename(fileName)

  // Tentukan direktori tempat file disimpan
  const letterDir = path.resolve('uploads/procurement_letters')

  // Gabungkan path direktori dengan nama file yang sudah aman
  const filePath = path.join(letterDir, secureFileName)

  // Cek apakah file benar-benar ada di server
  if (!fs.existsSync(filePath)) {
    throw new ResponseError(404, 'File tidak ditemukan.')
  }

  // Jika aman dan ada, kembalikan path absolutnya
  return filePath
}
