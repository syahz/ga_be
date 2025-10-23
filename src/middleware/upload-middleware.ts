import multer from 'multer'
import path from 'path'
import fs from 'fs' // <-- 1. Impor 'fs'
import { ResponseError } from '../error/response-error'

// Tentukan direktori upload
const uploadDir = 'uploads/procurement_letters/'

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}
// ---------------------------------------------

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir) // Gunakan variabel uploadDir
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
})

function fileFilter(req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase()
  if (ext !== '.pdf') {
    return cb(new ResponseError(400, 'Hanya file PDF yang diperbolehkan'))
  }
  cb(null, true)
}

export const procurement_letter_upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // max 5MB
}).single('letterFile')
