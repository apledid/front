import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Resend-token signing for the email-code login flow.
 *
 * The login endpoint hands the client back a signed token so that
 * subsequent /resend calls can only be made by the original caller -
 * without it, anyone could trigger a new email to any user by
 * passing their userId. We sign the (userId, expiresAt) pair with
 * HMAC-SHA256 and verify on /resend.
 *
 * Two things matter:
 *
 * 1. The signing key has to be a real secret. The previous code did
 *    `process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-key'` which
 *    silently fell back to a literal public string if the env var
 *    was ever missing. That would make every resend token forgeable
 *    by anyone who's read the repo. Also, the Supabase service role
 *    key is the wrong secret to reuse - it's the DB master key,
 *    not a dedicated signing secret, so rotating it would invalidate
 *    every in-flight pending login.
 *
 * 2. Verification must be timing-safe. Direct `===` compare on the
 *    hex digest leaks the per-char match position; `timingSafeEqual`
 *    closes that side channel.
 *
 * Env var: RESEND_TOKEN_SIGNING_KEY. Required in production; module
 * load throws if it's missing and NODE_ENV is production. In dev we
 * fall back to a deterministic test key so `npm run dev` boots, but
 * we log a loud warning.
 */
function getSigningKey(): string {
  const key = process.env.RESEND_TOKEN_SIGNING_KEY
  if (key && key.length >= 32) return key
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'RESEND_TOKEN_SIGNING_KEY missing or shorter than 32 chars. ' +
      'Generate with `openssl rand -hex 32` and set in .env.'
    )
  }
  // Dev-only: stable so token verify still works across hot reloads.
  // Loud warning so nobody ships this.
  console.warn(
    '[resend-token] RESEND_TOKEN_SIGNING_KEY is not set. Using an ' +
    'insecure dev fallback. Set it in .env before deploying.'
  )
  return 'dev-only-do-not-ship-' + 'x'.repeat(32)
}

export function signResendToken(userId: string, expiresAt: number): string {
  return createHmac('sha256', getSigningKey())
    .update(`${userId}:${expiresAt}`)
    .digest('hex')
}

export function verifyResendToken(
  userId: string,
  expiresAt: number,
  token: string,
): boolean {
  if (typeof token !== 'string') return false
  const expected = signResendToken(userId, expiresAt)
  if (expected.length !== token.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token))
  } catch {
    return false
  }
}
