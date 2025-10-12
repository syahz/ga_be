import { Request, Response, NextFunction } from 'express'
import { getRules, createRule, updateRuleDetails, deleteRule, updateRuleSteps, getRuleById } from '../services/rule-services'
import { CreateRuleRequest, UpdateRuleRequest, UpdateRuleStepsRequest } from '../models/rule-model'

// Handler untuk GET /rules
export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const search = (req.query.search as string) || ''
    const response = await getRules(page, limit, search)
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}

// Handler untuk GET /rules/:ruleId
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ruleId } = req.params
    const response = await getRuleById(ruleId)
    res.status(200).json({
      data: response
    })
  } catch (e) {
    next(e)
  }
}

// Handler untuk POST /rules
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request: CreateRuleRequest = req.body
    const response = await createRule(request)
    res.status(201).json({ data: response })
  } catch (e) {
    next(e)
  }
}

// Handler untuk PUT /rules/:ruleId
export const updateRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ruleId = req.params.ruleId
    const request: UpdateRuleRequest = req.body
    const response = await updateRuleDetails(ruleId, request)
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}

// Handler untuk PUT /rules/step/:stepId
export const updateStep = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stepId = req.params.stepId
    const request: UpdateRuleStepsRequest = req.body
    const response = await updateRuleSteps(stepId, request)
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}

// Handler untuk DELETE /rules/:ruleId
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ruleId = req.params.ruleId
    const response = await deleteRule(ruleId)
    res.status(200).json({ data: response })
  } catch (e) {
    next(e)
  }
}
