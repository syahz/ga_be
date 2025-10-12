import { config } from 'dotenv'

config({ path: '.env' })

export const {
  PORT,
  SMTP_EMAIL,
  SMTP_PASSWORD,
  LOG_DIR,
  SECRET_KEY,
  FRONTEND_URL,
  NODE_ENV,
  REFRESH_TOKEN_SECRET_KEY,
  ACCESS_TOKEN_SECRET,
  COOKIE_DOMAIN,
  BASE_URL
} = process.env
