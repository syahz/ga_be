import express from 'express'
import { create, get, getById, remove, updateRule, updateStep } from '../../controller/rule-controller'

const ruleRoutes = express.Router()

// GET /api/admin/rules -> Mengambil semua aturan
ruleRoutes.get('/', get)

// GET /api/admin/rules/:ruleId -> Mengambil satu aturan berdasarkan ID
ruleRoutes.get('/:ruleId', getById)

// POST /api/admin/rules -> Membuat aturan baru
ruleRoutes.post('/', create)

// PUT /api/admin/rules/:ruleId -> Update detail aturan (name, amount)
ruleRoutes.put('/:ruleId', updateRule)

// PUT /api/admin/rules/step/:stepId -> Update satu step (misal, ganti role)
ruleRoutes.put('/step/:stepId', updateStep)

// DELETE /api/admin/rules/:ruleId -> Hapus aturan dan semua stepnya
ruleRoutes.delete('/:ruleId', remove)

export default ruleRoutes
