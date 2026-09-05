import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { pool } from '@/lib/db'

/**
 * Better Auth server config wired to the existing Neon database.
 *
 * The session secret comes from the pre-provisioned `NEON_AUTH_COOKIE_SECRET`.
 *
 * NOTE: `baseURL` must be THIS app's own origin. It must NOT be set to
 * `NEON_AUTH_BASE_URL` — that variable points at the Neon Auth service
 * endpoint and carries a path (`/neondb/auth`). Better Auth derives its
 * mount path (`basePath`) from `baseURL`'s pathname, so using it would move
 * the handler off `/api/auth` and make every `/api/auth/*` request 404.
 */
const authBaseURL =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.V0_RUNTIME_URL)

// Vercel/v0 exposes HTTPS to the browser even when the server process uses a
// localhost fallback. Only the explicit local HTTP case should use Lax.
const isHttpsPreview = Boolean(
  process.env.VERCEL_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.V0_RUNTIME_URL ||
    process.env.V0_DEV_APP_URL ||
    process.env.V0_BUILD_URL ||
    process.env.V0_SANDBOX_URL,
)

export const auth = betterAuth({
  database: pool,
  secret: process.env.NEON_AUTH_COOKIE_SECRET,
  baseURL: authBaseURL,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  trustedOrigins: [
    ...(process.env.NODE_ENV === 'development'
      ? [
          'http://localhost:3000',
          ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
          ...(process.env.V0_DEV_APP_URL ? [process.env.V0_DEV_APP_URL] : []),
          ...(process.env.V0_BUILD_URL ? [process.env.V0_BUILD_URL] : []),
          ...(process.env.V0_SANDBOX_URL ? [process.env.V0_SANDBOX_URL] : []),
        ]
      : []),
    ...(process.env.NODE_ENV === 'production'
      ? [
          ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
          ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
            : []),
        ]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  advanced: {
    // The Neon `neon_auth` tables use `uuid` primary keys, so Better Auth
    // must emit real UUIDs instead of its default random string IDs.
    database: {
      generateId: () => crypto.randomUUID(),
    },
    // v0/Vercel previews are HTTPS in the browser even when the server uses
    // localhost internally. Genuine HTTP localhost must use Lax; None without
    // Secure is rejected by browsers.
    ...(process.env.NODE_ENV === 'development'
      ? {
          defaultCookieAttributes: {
            sameSite: isHttpsPreview ? ('none' as const) : ('lax' as const),
            secure: isHttpsPreview,
          },
        }
      : {}),
  },
  // Must be last: propagates Set-Cookie from server actions into Next.js.
  plugins: [nextCookies()],
})
