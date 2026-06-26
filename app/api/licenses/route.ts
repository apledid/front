import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'

export async function GET(request: Request) {
  try {
    const rl = await withRateLimit(request, 'general')
    if (rl.response) return rl.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    const { data: licenses, error } = await admin
      .from('licenses')
      .select('*')
      .or(`purchased_by.eq.${profile.id},redeemed_by.eq.${profile.id}`)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({
      licenses: licenses || [],
      premiumActive: Boolean((profile as any).premium_active || (profile as any).is_premium),
    })
  } catch (error) {
    console.error('Licenses GET error:', error)
    return NextResponse.json({ error: 'Failed to load licenses' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Rate-limit redemption attempts. Without this, the only thing
    // protecting the 72-bit license-key space was the lack of an
    // attacker bothering to brute force it - which is exactly the
    // sort of assumption that breaks the day someone gets a single
    // key and reverses out an attack scope. Reusing the
    // verifyEmail bucket (10/15min) because the threat model
    // matches: bounded high-entropy code, attacker wants to brute
    // force, slow rate is plenty for legit redemptions.
    const rateLimit = await withRateLimit(request, 'verifyEmail')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Redemption requires the secret key, full stop. The previous
    // implementation also accepted a numeric `licenseId` lookup
    // which sidestepped the key-as-secret assumption - if any row
    // existed with purchased_by NULL and redeemed_by NULL (legacy
    // rows, manual DB inserts, test data, or a race window during
    // staff key creation) any logged-in user could enumerate ids
    // and claim it for instant premium. Drop the branch entirely.
    const { licenseKey } = await request.json()
    if (!licenseKey || typeof licenseKey !== 'string') {
      return NextResponse.json({ error: 'License key required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: license, error } = await admin
      .from('licenses')
      .select('*')
      .eq('license_key', licenseKey.trim())
      .single()

    if (error || !license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }

    // Unclaimed rows (no purchased_by, no redeemed_by) are
    // unreachable through this endpoint. Anything in that state is
    // either staff-pending or a data integrity issue - never a
    // valid redemption target for a random caller.
    if (!license.purchased_by && !license.redeemed_by) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }

    if (license.redeemed_by && license.redeemed_by !== profile.id) {
      return NextResponse.json({ error: 'License already redeemed by another account' }, { status: 400 })
    }

    if (license.purchased_by && license.purchased_by !== profile.id && !license.redeemed_by) {
      return NextResponse.json({ error: 'That license belongs to another account' }, { status: 403 })
    }

    const redeemedAt = new Date().toISOString()
    const { error: redeemError } = await admin
      .from('licenses')
      .update({
        status: 'redeemed',
        redeemed_by: profile.id,
        redeemed_at: redeemedAt,
      })
      .eq('id', license.id)
      // Atomic claim: only the first concurrent request flips an unclaimed
      // license, closing the double-claim race. A re-redeem by the same owner
      // no-ops here (already set); the premium grant below is idempotent, so
      // this is purely race-safety with no behaviour change for the user.
      .is('redeemed_by', null)

    if (redeemError) {
      return NextResponse.json({ error: redeemError.message }, { status: 400 })
    }

    await admin
      .from('profiles')
      .update({ is_premium: true, premium_active: true, premium_activated_at: redeemedAt, updated_at: redeemedAt })
      .eq('id', profile.id)

    await admin.from('inbox_messages').insert({
      user_id: profile.id,
      subject: 'Premium unlocked',
      body: `Your ${license.plan_name} key has been redeemed. Premium is now active on your account.`,
      message_type: 'system',
      from_staff: false,
    })

    return NextResponse.json({ success: true, premiumActive: true })
  } catch (error) {
    console.error('Licenses POST error:', error)
    return NextResponse.json({ error: 'Failed to redeem license' }, { status: 500 })
  }
}
