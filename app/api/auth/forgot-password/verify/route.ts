import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'
import { pendingResets } from '@/lib/pending-resets'
import { constantTimeEqual } from '@/lib/api-auth'

export async function POST(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'verifyEmail')
    if (rateLimit.response) return rateLimit.response

    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
    }

    const emailLower = email.trim().toLowerCase()

    // Look up userId from email (pendingResets is keyed by userId)
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', emailLower)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'No pending reset. Please request a new code.' }, { status: 400 })
    }

    const pending = await pendingResets.get(profile.id)

    if (!pending) {
      return NextResponse.json({ error: 'No pending reset. Please request a new code.' }, { status: 400 })
    }

    if (Date.now() > pending.expiresAt) {
      await pendingResets.delete(profile.id)
      return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 })
    }

    if (pending.attempts >= 5) {
      await pendingResets.delete(profile.id)
      return NextResponse.json({ error: 'Too many failed attempts. Please request a new code.' }, { status: 429 })
    }

    if (!constantTimeEqual(pending.code, code)) {
      await pendingResets.incrementAttempts(profile.id)
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    // Code is valid - don't delete yet, the reset step will need it
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Forgot password verify error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
