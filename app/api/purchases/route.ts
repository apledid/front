import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateLicenseKey } from '@/lib/staff'
import { withRateLimit } from '@/lib/rate-limit'

const PLANS = {
  stellar: { name: 'Stellar', type: 'subscription' },
  flashy: { name: 'Flashy', type: 'subscription' },
  honored: { name: 'Honored', type: 'purchase' },
} as const

export async function POST(request: Request) {
  try {
    const rl = await withRateLimit(request, 'general')
    if (rl.response) return rl.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only admins can manually issue licenses - premium is granted via Stripe webhook
    if (!(profile as any).is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { planId } = await request.json()
    const plan = PLANS[planId as keyof typeof PLANS]
    if (!plan) {
      return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })
    }

    const admin = createAdminClient()
    
    const licenseKey = generateLicenseKey(plan.name)

    // Insert license - purchased_by references profiles.id
    const { error: licenseError } = await admin
      .from('licenses')
      .insert({
        license_key: licenseKey,
        plan_name: plan.name,
        plan_type: plan.type,
        status: 'pending',
        purchased_by: profile.id,
      })

    if (licenseError) {
      console.error('License insert error:', licenseError)
      return NextResponse.json({ error: licenseError.message }, { status: 400 })
    }

    await admin.from('inbox_messages').insert({
      user_id: profile.id,
      title: `${plan.name} key delivered`,
      subject: `${plan.name} key delivered`,
      body: `Your ${plan.name} purchase was created successfully. Redeem your key from Premium or copy it from this inbox message.`,
      message_type: 'license',
      license_key: licenseKey,
      from_staff: false,
      staff_username: profile.username || null,
    })

    return NextResponse.json({
      success: true,
      licenseKey,
      planName: plan.name,
      dashboardRedirect: '/dashboard',
    })
  } catch (error) {
    console.error('Purchase API error:', error)
    return NextResponse.json({ error: 'Failed to create purchase' }, { status: 500 })
  }
}
