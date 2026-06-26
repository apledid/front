import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const rateLimit = await withRateLimit(request, 'general')
  if (rateLimit.response) return rateLimit.response

  const profile = await getApiUser()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  await admin.from('profiles').update({ discord_id: null }).eq('id', profile.id)

  return NextResponse.json({ success: true })
}
