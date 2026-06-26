import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getApiUser } from '@/lib/api-auth'
import { withRateLimit } from '@/lib/rate-limit'

// POST - Redeem a license key
export async function POST(request: Request) {
  try {
    // Tight rate limit to prevent key brute-forcing
    const rateLimit = await withRateLimit(request, 'verifyEmail')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already has premium
    if (profile.premium_active) {
      return NextResponse.json({ error: 'You already have an active premium plan' }, { status: 400 })
    }

    const body = await request.json()
    const { key } = body

    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'License key is required' }, { status: 400 })
    }

    // Normalize the key (uppercase, trim)
    const normalizedKey = key.trim().toUpperCase()

    const admin = createAdminClient()

    // Find the key
    const { data: licenseKey, error: findError } = await admin
      .from('license_keys')
      .select('*')
      .eq('key', normalizedKey)
      .single()

    if (findError || !licenseKey) {
      return NextResponse.json({ error: 'Invalid license key' }, { status: 400 })
    }

    // Check if already redeemed
    if (licenseKey.redeemed_by) {
      return NextResponse.json({ error: 'This license key has already been redeemed' }, { status: 400 })
    }

    // Check if expired
    if (licenseKey.expires_at && new Date(licenseKey.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This license key has expired' }, { status: 400 })
    }

    // Redeem the key - mark it as used. The `.is('redeemed_by', null)`
    // predicate makes this an atomic compare-and-swap so two concurrent
    // requests with the same key can't both pass the earlier null-check
    // and both succeed. If the row was already claimed between the read
    // above and this update, the update affects zero rows and we bail.
    const { data: claimed, error: redeemError } = await admin
      .from('license_keys')
      .update({
        redeemed_by: profile.id,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', licenseKey.id)
      .is('redeemed_by', null)
      .select('id')
      .maybeSingle()

    if (redeemError) {
      return NextResponse.json({ error: 'Failed to redeem key' }, { status: 500 })
    }
    if (!claimed) {
      return NextResponse.json({ error: 'This license key has already been redeemed' }, { status: 400 })
    }

    // Activate premium for the user
    const { error: activateError } = await admin
      .from('profiles')
      .update({
        premium_active: true,
        premium_type: licenseKey.plan_type,
        premium_activated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (activateError) {
      return NextResponse.json({ error: 'Failed to activate premium' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'License key redeemed successfully! You now have lifetime premium access.',
      plan: licenseKey.plan_type
    })
  } catch (error) {
    console.error('Error redeeming license key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
