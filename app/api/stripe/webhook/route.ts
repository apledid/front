import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  // SECURITY: Webhook signature MUST be verified - this is critical
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    // Don't log the error - just reject
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    // SECURITY FIX: Only activate premium if:
    // 1. userId is provided in metadata (user set it themselves in checkout)
    // 2. plan is 'lifetime'
    // DO NOT allow email-based fallback activation (enables account takeover)
    const userId = session.metadata?.user_id
    const plan = session.metadata?.plan

    if (userId && plan === 'lifetime') {
      const admin = createAdminClient()

      // Activate premium for the user
      // Note: We trust Stripe's signature validation above, so metadata is authentic
      const { error } = await admin
        .from('profiles')
        .update({
          premium_active: true,
          premium_type: 'lifetime',
          premium_activated_at: new Date().toISOString(),
          stripe_customer_id: session.customer as string,
          stripe_payment_id: session.payment_intent as string,
        })
        .eq('id', userId)

      if (error) {
        // Log error details internally, but don't expose to user
        console.error('[Stripe] Premium activation failed for user:', error.code)
        return NextResponse.json({ received: true }) // Still return 200 to prevent webhook retry
      }
    }
    // Silently ignore webhooks with missing userId or invalid plan
  }

  return NextResponse.json({ received: true })
}
