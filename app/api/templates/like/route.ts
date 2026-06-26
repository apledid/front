import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'

// One like/favorite per (user, template) - enforced by composite PK in DB.
// This handler is idempotent: it checks existence, flips state once, and
// then recomputes likes_count from the authoritative row count so rapid
// clicks can't drift the counter.
async function toggle(table: 'template_likes' | 'template_favorites', request: Request) {
  const rateLimit = await withRateLimit(request, 'general')
  if (rateLimit.response) return rateLimit.response

  const profile = await getApiUser()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Template id required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from(table)
    .select('template_id')
    .eq('template_id', id)
    .eq('user_id', profile.id)
    .maybeSingle()

  let liked: boolean
  if (existing) {
    await admin.from(table).delete().eq('template_id', id).eq('user_id', profile.id)
    liked = false
  } else {
    // Use upsert to be race-safe against double-click; composite PK
    // dedupes automatically.
    const { error: upErr } = await admin
      .from(table)
      .upsert({ template_id: id, user_id: profile.id }, { onConflict: 'template_id,user_id', ignoreDuplicates: true })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })
    liked = true
  }

  // Only likes have a denormalized count on templates
  if (table === 'template_likes') {
    const { count } = await admin
      .from('template_likes')
      .select('*', { count: 'exact', head: true })
      .eq('template_id', id)
    await admin.from('templates').update({ likes_count: count || 0 }).eq('id', id)
    return NextResponse.json({ liked, likes_count: count || 0 })
  }

  return NextResponse.json({ liked })
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const kind = url.searchParams.get('kind') === 'favorite' ? 'template_favorites' : 'template_likes'
    return await toggle(kind as any, request)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })
  }
}
