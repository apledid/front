import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { generateVerificationCode } from '@/lib/token-generation'
import { withRateLimit } from '@/lib/rate-limit'

function generateCode(): string {
  return generateVerificationCode(6)
}

export async function POST(request: Request) {
  try {
    // Rate limit: 3 emails per minute per IP
    const rateLimit = await withRateLimit(request, 'sendEmail')
    if (rateLimit.response) return rateLimit.response

    const { email, username } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Check if email already exists in profiles
    const { data: existingEmail } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (existingEmail) {
      // Don't reveal that the email is registered (enumeration oracle on an
      // unauthenticated route) - return the same generic success as a real send.
      return NextResponse.json({ success: true })
    }

    // Generate verification code
    const code = generateCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Store pending verification
    const { error: upsertError } = await admin.from('pending_verifications').upsert({
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      code,
      expires_at: expiresAt.toISOString(),
    }, { onConflict: 'email' })

    if (upsertError) {
      console.error('Verification storage error:', upsertError)
    }

    // Send email with Resend
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      
      const resp = await resend.emails.send({
        from: 'Halo <noreply@halo.rip>',
        to: email,
        subject: 'Your verification code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #a855f7; text-align: center;">Verification Code</h2>
            <p style="text-align: center; color: #666;">Use this code to verify your email:</p>
            <div style="background: linear-gradient(135deg, #a855f7, #6366f1); color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 12px; letter-spacing: 8px; margin: 20px 0;">
              ${code}
            </div>
            <p style="text-align: center; color: #999; font-size: 12px;">This code expires in 10 minutes.</p>
          </div>
        `,
      })
      console.log('[Resend/send-verification]', JSON.stringify(resp))
      if ((resp as any)?.error) {
        return NextResponse.json({ error: (resp as any).error?.message || 'Email send failed' }, { status: 500 })
      }
    } else {
      // No Resend API key - log code for testing
      // Log only success/failure, not the code or email
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send verification error:', error)
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 })
  }
}
