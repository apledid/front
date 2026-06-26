import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'

const PAGE_SIZE = 50

export async function GET(request: Request) {
  try {
    // Rate-limit inbox reads. PATCH already had this bucket but GET
    // was wide open - an authed user could hammer the endpoint as
    // fast as their network allows, putting unbounded read pressure
    // on the inbox_messages table. 'general' is 60/min/IP which is
    // way more than any legitimate inbox open generates.
    const rl = await withRateLimit(request, 'general')
    if (rl.response) return rl.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url    = new URL(request.url)
    const cursor = url.searchParams.get('cursor') // created_at of last item for keyset pagination
    const limit  = Math.min(Number(url.searchParams.get('limit') || PAGE_SIZE), 100)

    const admin = createAdminClient()
    let query = admin
      .from('inbox_messages')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const messages   = data || []
    const nextCursor = messages.length === limit ? messages[messages.length - 1]?.created_at : null

    return NextResponse.json(
      { messages, nextCursor, hasMore: nextCursor !== null },
      { headers: { 'Cache-Control': 'private, max-age=5, stale-while-revalidate=10' } },
    )
  } catch (error) {
    console.error('Inbox GET error:', error)
    return NextResponse.json({ error: 'Failed to load inbox' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'general')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messageId } = await request.json()
    const admin = createAdminClient()
    const { error } = await admin
      .from('inbox_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('user_id', profile.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Inbox PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 })
  }
}
