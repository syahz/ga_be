import fs from 'fs'
import path from 'path'
import { LogAction } from '@prisma/client'
import {
  ProgressResponse,
  toProgressResponse,
  toHistoryLogResponse,
  ProcurementLogFormData,
  ProcessDecisionRequestDto,
  ProcurementLetterResponse,
  CreateProcurementRequestDto,
  UpdateProcurementRequestDto,
  toProcurementLetterResponse,
  toAllProcurementLettersResponse,
  toDashboardProcurementLettersResponse
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
 * Mengambil data dashboard untuk user tertentu.
 */
export const getDashboardUserServices = async (user: UserWithRelations) => {
  const unit = await prismaClient.unit.findUnique({ where: { id: user.unitId } })
  if (!unit) {
    throw new ResponseError(404, 'Unit not found for the user')
  }

  const dashboardData = await prismaClient.procurementLetter.findMany({
    where: { unitId: unit?.id },
    include: {
      createdBy: { select: { name: true } },
      currentApprover: { select: { name: true } },
      unit: { select: { name: true } }
    }
  })
  return dashboardData.map(toProcurementLetterResponse)
}

/**
 * Mengambil data dashboard untuk admin.
 */
export const getDashboardAdminServices = async (page: number, limit: number, search: string, unitId?: string) => {
  const skip = (page - 1) * limit

  const baseWhere: any = {
    ...(unitId ? { unitId } : {})
  }

  let searchFilter = {}
  if (search) {
    const isNumeric = !isNaN(parseFloat(search)) && isFinite(Number(search))
    searchFilter = {
      OR: [
        { letterNumber: { contains: search } },
        { letterAbout: { contains: search } },
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

  const totalInUnit = unitId ? await prismaClient.procurementLetter.count({ where: { unitId } }) : await prismaClient.procurementLetter.count()

  // Summary counts (scoped by unitId if provided), ignoring search/pagination
  const approvedWhere: any = unitId ? { unitId, status: 'APPROVED' } : { status: 'APPROVED' }
  const rejectedWhere: any = unitId ? { unitId, status: 'REJECTED' } : { status: 'REJECTED' }
  const [totalApproved, totalRejected] = await prismaClient.$transaction([
    prismaClient.procurementLetter.count({ where: approvedWhere }),
    prismaClient.procurementLetter.count({ where: rejectedWhere })
  ])

  return toDashboardProcurementLettersResponse(letters, totalLetters, page, limit, totalInUnit, totalApproved, totalRejected)
}

/**
 * Membuat surat pengadaan baru menggunakan model ProcurementRule dan ProcurementStep.
 */
export const createProcurementLetter = async (request: CreateProcurementRequestDto, user: UserWithRelations) => {
  const createRequest = Validation.validate(ProcurementValidation.CREATE, request)
  // BigInt-safe logging of validated payload
  logger.debug(JSON.stringify(createRequest, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
  const nominal = typeof (createRequest as any).nominal === 'bigint' ? (createRequest as any).nominal : BigInt((createRequest as any).nominal)

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
export const getProcurementLetters = async (user: UserWithRelations, page: number, limit: number, search: string) => {
  const skip = (page - 1) * limit

  const baseWhere = {
    OR: [{ currentApproverId: user.id }, { createdById: user.id, status: 'NEEDS_REVISION' as const }]
  }

  let searchFilter = {}
  if (search) {
    const isNumeric = !isNaN(parseFloat(search)) && isFinite(Number(search))
    searchFilter = {
      OR: [
        { letterNumber: { contains: search } },
        { letterAbout: { contains: search } },
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
 * Mengambil daftar surat pengadaan sebagai history logs
 */
export const getHistoryLogs = async (user: UserWithRelations, page: number, limit: number, search: string) => {
  const skip = (page - 1) * limit

  // 1. Bangun filter pencarian untuk relasi surat dan field log
  let procurementLetterFilter: any = {}
  const logFieldFilters: any[] = []
  if (search) {
    const isNumeric = !isNaN(parseFloat(search)) && isFinite(Number(search))
    procurementLetterFilter = {
      OR: [
        { letterNumber: { contains: search } },
        { letterAbout: { contains: search } },
        ...(isNumeric ? [{ nominal: { equals: BigInt(search) } }] : [])
      ]
    }

    // Log fields: action (enum, partial match via IN), comment (contains), timestamp (day range)
    const sLower = search.toLowerCase()
    const actionCandidates = (Object.values(LogAction) as unknown as string[]).filter((a) => a.toLowerCase().includes(sLower))
    if (actionCandidates.length > 0) {
      logFieldFilters.push({ action: { in: actionCandidates as any } })
    }
    logFieldFilters.push({ comment: { contains: search } })

    const parsed = new Date(search)
    if (!isNaN(parsed.getTime())) {
      const start = new Date(parsed)
      start.setHours(0, 0, 0, 0)
      const end = new Date(parsed)
      end.setHours(23, 59, 59, 999)
      logFieldFilters.push({ timestamp: { gte: start, lte: end } })
    }
  }

  // 2. WHERE utama untuk ProcurementLog: actorId wajib; jika ada search, OR antara relasi surat dan field log
  const where: any = { actorId: user.id }
  if (search) {
    const orClauses: any[] = []
    orClauses.push({ procurementLetter: procurementLetterFilter })
    if (logFieldFilters.length > 0) {
      orClauses.push({ OR: logFieldFilters })
    }
    where.AND = [{ OR: orClauses }]
  }

  // 3. Lakukan query langsung ke ProcurementLog.
  const [totalLogs, logs] = await prismaClient.$transaction([
    prismaClient.procurementLog.count({ where }),
    prismaClient.procurementLog.findMany({
      where,
      include: {
        // Sertakan detail surat untuk setiap log
        procurementLetter: {
          include: {
            createdBy: { select: { name: true } },
            currentApprover: { select: { name: true } },
            unit: { select: { name: true } }
          }
        }
      },
      skip,
      take: limit,
      orderBy: { timestamp: 'desc' }
    })
  ])

  return toHistoryLogResponse(logs, totalLogs, page, limit)
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
 * Mendapatkan file surat pengadaan.
 * File disajikan dari direktori upload.
 */
export const getProcurementLetterPath = async (fileName: string): Promise<string> => {
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

/**
 * Memperbarui surat pengadaan yang sudah ada.
 * Hanya pembuat asli yang dapat mengedit surat dengan status 'NEEDS_REVISION'.
 * Jika ada file baru diunggah, file lama akan dihapus dari server.
 * Setelah revisi, status surat kembali ke 'PENDING_REVIEW' dan harus di-assign ulang ke approver pertama.
 */
export const updateProcurementLetter = async (
  letterId: string,
  request: UpdateProcurementRequestDto,
  user: UserWithRelations
): Promise<ProcurementLetterResponse> => {
  const updateRequest = Validation.validate(ProcurementValidation.UPDATE, request)

  // 1. Cari surat yang akan diupdate
  const existingLetter = await prismaClient.procurementLetter.findUnique({
    where: { id: letterId }
  })

  if (!existingLetter) {
    throw new ResponseError(404, 'Surat pengadaan tidak ditemukan.')
  }

  // 2. Otorisasi: Pastikan hanya pembuat asli yang bisa mengedit saat status 'NEEDS_REVISION'
  if (existingLetter.createdById !== user.id || existingLetter.status !== 'NEEDS_REVISION') {
    throw new ResponseError(403, 'Anda tidak berwenang untuk mengedit pengajuan ini.')
  }

  // 3. Logika Hapus File Lama
  // Cek jika ada file baru yang diunggah (`letterFile` di request tidak kosong)
  // DAN file lama memang ada di record database.
  if (updateRequest.letterFile && existingLetter.letterFile) {
    try {
      const oldFilePath = path.join('uploads/procurement_letters/', existingLetter.letterFile)
      await fs.promises.unlink(oldFilePath)
      logger.info(`Old file deleted: ${oldFilePath}`)
    } catch (error) {
      logger.warn(`Failed to delete old file, it may not exist: ${existingLetter.letterFile}`, error)
    }
  }

  // 4. Update data di database
  // Setelah direvisi, status kembali menjadi PENDING_REVIEW dan harus di-assign kembali ke approver pertama
  const nominal = typeof (updateRequest as any).nominal === 'bigint' ? (updateRequest as any).nominal : BigInt((updateRequest as any).nominal)
  const rule = await prismaClient.procurementRule.findFirst({
    where: {
      minAmount: { lte: nominal },
      OR: [{ maxAmount: { gte: nominal } }, { maxAmount: null }]
    },
    include: { steps: { orderBy: { stepOrder: 'asc' }, include: { role: true } } }
  })
  if (!rule) {
    throw new ResponseError(500, 'Aturan pengadaan untuk nominal ini tidak ditemukan.')
  }
  const firstApproverStep = rule.steps[1]
  const nextApprover = await prismaClient.user.findFirst({
    where: HEAD_OFFICE_ROLES.includes(firstApproverStep.role.name)
      ? { roleId: firstApproverStep.role.id, unit: { code: HEAD_OFFICE_CODE } }
      : { roleId: firstApproverStep.role.id, unitId: existingLetter.unitId }
  })
  if (!nextApprover) {
    throw new ResponseError(404, 'Approver berikutnya tidak ditemukan.')
  }

  const updatedLetter = await prismaClient.procurementLetter.update({
    where: { id: letterId },
    data: {
      letterNumber: updateRequest.letterNumber,
      letterAbout: updateRequest.letterAbout,
      incomingLetterDate: new Date(updateRequest.incomingLetterDate),
      nominal,
      ...(updateRequest.letterFile ? { letterFile: updateRequest.letterFile } : {}),
      status: 'PENDING_REVIEW',
      currentApproverId: nextApprover.id
    },
    include: {
      createdBy: { select: { name: true } },
      currentApprover: { select: { name: true } },
      unit: { select: { name: true } }
    }
  })

  await prismaClient.procurementLog.create({
    data: { procurementLetterId: updatedLetter.id, actorId: user.id, action: 'SUBMITTED', comment: 'Pengadaan direvisi dan diajukan kembali.' }
  })

  return toProcurementLetterResponse(updatedLetter)
}

/**
 * Mendapatkan detail surat pengadaan berdasarkan ID surat.
 */
export const getProcurementDetails = async (user: UserWithRelations, letterId: string) => {
  const letter = await prismaClient.procurementLetter.findUnique({
    where: { id: letterId }
  })
  if (!letter) {
    throw new ResponseError(404, 'Procurement letter not found')
  }
  if (letter.createdById !== user.id && letter.currentApproverId !== user.id) {
    throw new ResponseError(403, 'You are not authorized to view this letter')
  }
  const letters = await prismaClient.procurementLetter.findFirst({
    where: { id: letterId },
    include: {
      createdBy: { select: { name: true } },
      currentApprover: { select: { name: true } },
      unit: { select: { name: true } }
    }
  })
  if (!letters) {
    throw new ResponseError(404, 'Procurement letter not found')
  }
  return toProcurementLetterResponse(letters)
}

/**
 * Mendapatkan progress (detail + logs) surat pengadaan berdasarkan ID surat.
 */
export const getProcurementProgress = async (letterId: string): Promise<ProgressResponse> => {
  const letter = await prismaClient.procurementLetter.findUnique({
    where: { id: letterId }
  })
  if (!letter) {
    throw new ResponseError(404, 'Procurement letter not found')
  }
  const letters = await prismaClient.procurementLetter.findFirst({
    where: { id: letterId },
    include: {
      createdBy: { select: { name: true } },
      currentApprover: { select: { name: true } },
      unit: { select: { name: true } }
    }
  })
  if (!letters) {
    throw new ResponseError(404, 'Procurement letter not found')
  }
  const logs = await prismaClient.procurementLog.findMany({
    where: { procurementLetterId: letterId },
    include: { actor: true },
    orderBy: { timestamp: 'desc' }
  })

  const formattedLogs: ProcurementLogFormData[] = logs.map((log) => {
    return {
      logId: log.id, // Map `id` to `logId`
      action: log.action,
      comment: log.comment,
      timestamp: log.timestamp.toISOString(), // Convert Date to string
      actor: {
        id: log.actor.id,
        name: log.actor.name
      },
      actorId: log.actorId // This property is inherited from the Omit
    }
  })

  return toProgressResponse(letters, formattedLogs)
}
