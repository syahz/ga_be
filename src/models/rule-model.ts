import { ProcurementRule, ProcurementStep, Role, StepType } from '@prisma/client'

// --- DTO untuk Request Body ---

// DTO untuk satu 'step' saat membuat aturan baru
interface StepCreationDto {
  stepOrder: number
  stepType: StepType
  roleId: string
}

// DTO untuk endpoint: POST /rules
export interface CreateRuleRequest {
  name: string
  minAmount: number
  maxAmount?: number | null
  steps: StepCreationDto[] // Minimal 3 langkah, bisa lebih
}

// DTO untuk endpoint: PUT /rules/:ruleId
export interface UpdateRuleRequest {
  name?: string
  minAmount?: number
  maxAmount?: number | null
}

// DTO untuk endpoint: PUT /rules/step/:stepId
export interface UpdateRuleStepsRequest {
  steps: {
    stepOrder: number
    roleId: string
  }[]
}

// --- Tipe untuk Response ---

// Tipe data final untuk satu baris 'step'
type StepResponse = {
  id: string
  stepOrder: number
  stepType: StepType
  role: {
    id: string
    name: string
  }
}

// Tipe data final untuk satu 'rule' yang dikirim sebagai response
export type RuleWithStepsResponse = {
  id: string
  name: string
  minAmount: string
  maxAmount: string | null
  steps: StepResponse[]
}

// Tipe data untuk response get all, termasuk paginasi
export type GetAllRulesResponse = {
  rules: RuleWithStepsResponse[]
  pagination: {
    total_data: number
    page: number
    limit: number
    total_page: number
  }
}

// --- Helper Functions (Mapper) ---

type RuleWithRelations = ProcurementRule & {
  steps: (ProcurementStep & { role: Role })[]
}

export function toRuleWithStepsResponse(rule: RuleWithRelations): RuleWithStepsResponse {
  return {
    id: rule.id,
    name: rule.name,
    minAmount: rule.minAmount.toString(),
    maxAmount: rule.maxAmount ? rule.maxAmount.toString() : null,
    steps: rule.steps
      .sort((a, b) => a.stepOrder - b.stepOrder) // Pastikan urutan selalu benar
      .map((step) => ({
        id: step.id,
        stepOrder: step.stepOrder,
        stepType: step.stepType,
        role: {
          id: step.role.id,
          name: step.role.name
        }
      }))
  }
}

export function toAllRulesResponse(rules: RuleWithRelations[], total: number, page: number, limit: number): GetAllRulesResponse {
  return {
    rules: rules.map(toRuleWithStepsResponse),
    pagination: {
      total_data: total,
      page,
      limit,
      total_page: Math.ceil(total / limit)
    }
  }
}
