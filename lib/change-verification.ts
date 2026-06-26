// Shared helpers for the in-app email + password change flows.
// Both flows (POST /api/auth/change-email/* and /change-password/*)
// land in change_verifications with a (user_id, purpose) row that
// holds the sha256 of a 6-digit code, the address we sent it to, and
// optional flow-specific payload (e.g. the pending new_email).
//
// Why a dedicated helper module:
//   - Code generation + hash + expiry are identical across email
//     and password flows.
//   - Email-send formatting should look consistent (same brand,
//     same do-not-reply footer).
//   - One place to add metrics or audit logs later.

import { createHash } from 'crypto'
import { Resend } from 'resend'
import { generateVerificationCode } from '@/lib/token-generation'

// 10 minutes feels right: short enough that an intercepted code
// is unlikely to still be useful by the time it leaks, long enough
// for a user to alt-tab to their email client, find the code, and
// paste it back in without panic.
export const CODE_TTL_MS = 10 * 60 * 1000

// 5 attempts before the row locks. The user can /start again to
// burn the locked row and get a fresh code. 5 attempts on a 6-digit
// space is ~5/1,000,000 = 0.0005% guessing odds, which is safe.
export const MAX_ATTEMPTS = 5

export function makeCode(): string {
  return generateVerificationCode(6)
}

export function hashCode(code: string): string {
  return createHash('sha256').update(code.trim()).digest('hex')
}

export function expiryIso(): string {
  return new Date(Date.now() + CODE_TTL_MS).toISOString()
}

interface SendCodeArgs {
  to: string
  username: string
  code: string
  // What is this code for, in human words. Shows up in the email
  // subject + body so users understand why they got it.
  context: 'email-change-current' | 'email-change-new' | 'password-change'
}

const CONTEXT_COPY: Record<
  SendCodeArgs['context'],
  { subject: string; heading: string; intro: string }
> = {
  'email-change-current': {
    subject: 'Confirm your email change - halo.rip',
    heading: 'Email change requested',
    intro: "You asked to change the email on your halo.rip account. To prove this is you, enter the code below on the settings page. We'll then send a separate code to your new address before any change is applied.",
  },
  'email-change-new': {
    subject: 'Verify your new email - halo.rip',
    heading: 'New email verification',
    intro: 'You verified your current email, so this is the second step. Enter the code below on the settings page to finish moving your account to this address.',
  },
  'password-change': {
    subject: 'Confirm your password change - halo.rip',
    heading: 'Password change requested',
    intro: 'You asked to change the password on your halo.rip account. Enter the code below on the settings page before picking your new password. If this was not you, you can ignore this email and your password will stay the same.',
  },
}

export async function sendCodeEmail({ to, username, code, context }: SendCodeArgs): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    // Dev fallback: surface the code to the server log so a
    // developer running `npm run dev` can complete the flow
    // without a real Resend key. Gated on NODE_ENV so this
    // never leaks codes to a prod log stream (which is itself
    // an account-takeover vector if shipped).
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[change-verification] DEV code for ${to} (${context}): ${code}`)
    }
    return { ok: true }
  }

  const { subject, heading, intro } = CONTEXT_COPY[context]
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const resp = await resend.emails.send({
      from: 'halo.rip <noreply@halo.rip>',
      to,
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px; background: #0a0a0b;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #e87fa0; font-size: 28px; margin: 0;">halo.rip</h1>
          </div>
          <div style="background: #111113; border-radius: 12px; padding: 30px; border: 1px solid #222;">
            <h2 style="color: #fff; font-size: 18px; margin: 0 0 12px 0;">${heading}</h2>
            <p style="color: #cfcfd2; font-size: 14px; margin: 0 0 18px 0; line-height: 1.55;">
              Hey <strong>@${username}</strong>, ${intro}
            </p>
            <div style="background: linear-gradient(135deg, #e87fa0 0%, #d66f90 100%); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #fff;">${code}</span>
            </div>
            <p style="color: #888; font-size: 13px; margin: 0;">
              This code expires in 10 minutes. If this was not you, ignore this email and nothing will change.
            </p>
          </div>
          <p style="color: #555; font-size: 11px; text-align: center; margin-top: 24px;">
            Sent by halo.rip - do not reply to this email.
          </p>
        </div>
      `,
    })
    if ((resp as any)?.error) {
      console.error('[change-verification] Resend error:', (resp as any).error)
      return { ok: false, error: (resp as any).error?.message || 'Email send failed' }
    }
    return { ok: true }
  } catch (e: any) {
    console.error('[change-verification] Resend throw:', e)
    return { ok: false, error: 'Email send failed' }
  }
}
