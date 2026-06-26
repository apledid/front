import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAccountDeleted } from '@/lib/discord-webhook'
import bcrypt from 'bcryptjs'
import { withRateLimit } from '@/lib/rate-limit'

export async function DELETE(request: NextRequest) {
  try {
    const rl = await withRateLimit(request, 'login')
    if (rl.response) return rl.response

    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value
    const sessionToken = cookieStore.get('session_token')?.value

    if (!userId || !sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Require password confirmation
    const body = await request.json().catch(() => ({}))
    const { password } = body
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required to delete your account' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify the session is valid
    const { hashToken } = await import('@/lib/api-auth')
    const sessionHash = hashToken(sessionToken)
    const { data: session } = await admin
      .from('sessions')
      .select('id, expires_at')
      .eq('user_id', userId)
      .eq('token_hash', sessionHash)
      .maybeSingle()

    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 })
    }

    // Get username and password_hash for verification
    const { data: profile } = await admin.from('profiles').select('username, password_hash').eq('id', userId).single()

    if (!profile) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Verify password
    if (!profile.password_hash) {
      // Discord-only accounts - skip password check (they have no password)
    } else {
      const passwordValid = await bcrypt.compare(password, profile.password_hash)
      if (!passwordValid) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 403 })
      }
    }

    // Delete related data first (in case no cascade is set up).
    // Defensive: if a table has FK ON DELETE CASCADE, this delete is
    // a no-op. If it doesn't, the explicit delete here prevents either
    // FK constraint failure on the profile delete OR orphan rows
    // hanging around forever after the user is gone.
    //
    // List should cover every table that has a user_id (or
    // profile_id / reporter_id) FK to profiles. Update this when new
    // user-owned tables are added.
    await Promise.all([
      admin.from('social_links').delete().eq('user_id', userId),
      admin.from('custom_buttons').delete().eq('user_id', userId),
      admin.from('profile_badges').delete().eq('user_id', userId),
      admin.from('profile_badge_loadout').delete().eq('user_id', userId),
      admin.from('profile_title_loadout').delete().eq('user_id', userId),
      admin.from('music_history').delete().eq('user_id', userId),
      admin.from('page_views').delete().eq('profile_id', userId),
      admin.from('link_clicks').delete().eq('user_id', userId),
      admin.from('inbox_messages').delete().eq('user_id', userId),
      // Added 2026-05: tables that have shipped since this list was
      // first written but weren't included in the delete sweep.
      // Without these, deleting an account either failed on the FK
      // constraint check or left rows pointing at a now-missing user.
      admin.from('widgets').delete().eq('user_id', userId),
      admin.from('profile_presets').delete().eq('user_id', userId),
      admin.from('templates').delete().eq('user_id', userId),
      admin.from('template_likes').delete().eq('user_id', userId),
      admin.from('template_favorites').delete().eq('user_id', userId),
      admin.from('template_reports').delete().eq('reporter_id', userId),
      admin.from('sessions').delete().eq('user_id', userId),
    ])

    // Delete the profile
    const { error } = await admin
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (error) {
      console.error('Delete account error:', error)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    // Log to Discord
    logAccountDeleted(profile?.username || 'unknown').catch(() => {})

    // Clear cookies - match the (path, domain) tuple used by
    // lib/create-session.ts. Issue both a host-only and a
    // Domain=.halo.rip clear so any legacy host-only cookies still
    // around from before the Domain switch also go away.
    let cookieDomain: string | undefined
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      if (appUrl) {
        const host = new URL(appUrl).hostname
        if (host === 'halo.rip' || host.endsWith('.halo.rip')) {
          cookieDomain = '.halo.rip'
        }
      }
    } catch { /* host-only clear is enough in dev */ }

    const response = NextResponse.json({ success: true })
    const baseClear = { maxAge: 0, path: '/' }
    for (const name of ['user_id', 'session_token', 'session_created_at', 'staff_license']) {
      response.cookies.set(name, '', baseClear)
      if (cookieDomain) response.cookies.set(name, '', { ...baseClear, domain: cookieDomain })
    }

    return response
  } catch (error) {
    console.error('Delete account API error:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
