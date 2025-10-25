import { logger } from '../utils/logger'
import passport from 'passport'
import { prismaClient } from '../application/database'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: `${process.env.BASE_URL}/api/auth/google/callback`,
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await prismaClient.user.findUnique({
          where: { email: profile._json.email! },
          include: {
            role: true,
            unit: true
          }
        })

        if (user) {
          // Jika user ditemukan, lanjutkan dengan sukses
          logger.info(`Google login successful for existing user: ${user.email}`)
          return done(null, user)
        } else {
          logger.warn(`Google login failed for unregistered email: ${profile._json.email!}`)
          return done(null, false)
          // --------------------------
        }
      } catch (error) {
        // Jika ada error server, gagalkan dengan error
        logger.error('Error during Google OAuth strategy:', error)
        return done(error, false)
      }
    }
  )
)
