import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'

// How long an unverified account is kept before deletion (default: 48 hours)
const STALE_THRESHOLD_MS = parseInt(process.env.CLEANUP_STALE_HOURS || '48') * 60 * 60 * 1000

async function runCleanup() {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString()
  const admin = createAdminClient()

  // Fetch unverified accounts created before the cutoff
  const { data: stale, error: fetchError } = await admin
    .from('profiles')
    .select('id, username, email, created_at')
    .eq('email_verified', false)
    .lt('created_at', cutoff)

  if (fetchError) {
    throw new Error(`Failed to fetch stale accounts: ${fetchError.message}`)
  }

  if (!stale || stale.length === 0) {
    return { deleted: 0, accounts: [] }
  }

  const ids = stale.map((p) => p.id)

  // Delete sessions first (FK constraint)
  await admin.from('sessions').delete().in('user_id', ids)

  // Delete profiles
  const { error: deleteError } = await admin.from('profiles').delete().in('id', ids)

  if (deleteError) {
    throw new Error(`Failed to delete stale accounts: ${deleteError.message}`)
  }

  console.log(`[cleanup-unverified] Deleted ${stale.length} stale accounts:`, ids)

  return {
    deleted: stale.length,
    accounts: stale.map((p) => ({
      username: p.username,
      email: p.email,
      created_at: p.created_at,
    })),
  }
}

async function handler(request: Request) {
  const rl = await withRateLimit(request, 'general')
  if (rl.response) return rl.response

  const profile = await getApiUser()
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!profile.is_admin) {
    return NextResponse.json({ error: 'Forbidden. Admin only.' }, { status: 403 })
  }

  try {
    const result = await runCleanup()
    return NextResponse.json({
      success: true,
      threshold: `${STALE_THRESHOLD_MS / 3600000}h`,
      ...result,
    })
  } catch (error: any) {
    console.error('[cleanup-unverified] Error:', error)
    return NextResponse.json({ error: error?.message || 'Cleanup failed' }, { status: 500 })
  }
}

// Support both GET (browser bar) and POST (cron / webhook)
export const GET  = handler
export const POST = handler
