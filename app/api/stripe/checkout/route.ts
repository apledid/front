import { getApiUser } from '@/lib/api-auth'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { withRateLimit } from '@/lib/rate-limit'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const LIFETIME_PRICE_CENTS = 500 // $5.00
const LIFETIME_PRODUCT_ID = 'prod_UH7WfZy99eKEZu'

export async function POST(request: Request) {
  try {
    const rl = await withRateLimit(request, 'general')
    if (rl.response) return rl.response

    const profile = await getApiUser()

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (profile.premium_active) {
      return NextResponse.json({ error: 'Already have lifetime access' }, { status: 400 })
    }

    const { origin } = new URL(request.url)

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product: LIFETIME_PRODUCT_ID,
            unit_amount: LIFETIME_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/dashboard?payment=success`,
      cancel_url: `${origin}/pricing?payment=cancelled`,
      customer_email: profile.email || undefined,
      metadata: {
        user_id: profile.id,
        profile_id: profile.id,
        plan: 'lifetime',
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
