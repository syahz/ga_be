import { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { ResponseError } from '../error/response-error'
import { ZodError } from 'zod'

export const errorMiddleware = async (error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      errors: `Validation Error: ${JSON.stringify(error, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`
    })
  } else if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'File tidak boleh lebih besar dari 10MB.' : error.message
    res.status(400).json({
      errors: message
    })
  } else if (error instanceof ResponseError) {
    res.status(error.status).json({
      errors: error.message
    })
  } else {
    res.status(500).json({
      errors: error.message
    })
  }
}
