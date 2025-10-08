import { config } from 'dotenv'
import { web } from './application/web'

config()

const PORT = process.env.PORT || 4000

web.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
})