import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getApiUser, constantTimeEqual } from '@/lib/api-auth'
import { withRateLimit } from '@/lib/rate-limit'
import { hashCode } from '@/lib/change-verification'

export async function POST(request: Request) {
  try {
    // Rate limit: 10 verification attempts per 15 minutes per IP
    const rateLimit = await withRateLimit(request, 'verifyEmail')
    if (rateLimit.response) return rateLimit.response

    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { code } = await request.json()

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get current user with verification details
    const { data: profile, error: fetchError } = await admin
      .from('profiles')
      .select('verification_code, verification_expires_at, email')
      .eq('id', user.id)
      .single()

    if (fetchError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!profile.email) {
      return NextResponse.json({ error: 'No email to verify' }, { status: 400 })
    }

    if (!profile.verification_code) {
      return NextResponse.json({ error: 'No verification code pending' }, { status: 400 })
    }

    // Check if code expired
    if (profile.verification_expires_at && new Date(profile.verification_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 })
    }

    // Check if code matches (verification_code is stored hashed by add-email).
    if (!constantTimeEqual(profile.verification_code, hashCode(code.trim()))) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    // Mark email as verified and clear deadline
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        email_verified: true,
        verification_code: null,
        verification_expires_at: null,
        email_deadline: null, // Clear the 24-hour deadline
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error verifying email:', updateError)
      return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Email verified successfully!' 
    })
  } catch (error) {
    console.error('Verify email error:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}
