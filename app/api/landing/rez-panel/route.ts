import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'
import { sanitizeProfileForPublic } from '@/lib/sanitize-profile'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const rl = await withRateLimit(request, 'general')
    if (rl.response) return rl.response

    const admin = createAdminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('username', 'rez')
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    const userId = profile.id

    // Audio Manager limits: premium users get 5 rotating tracks, free get 3.
    // Mirror app/api/music/route.ts so this panel agrees with /[username] +
    // dashboard. rez is premium so this evaluates to 5 in practice, but
    // keying off premium_active keeps the rule consistent everywhere.
    const musicTrackLimit = profile.premium_active ? 5 : 3

    // Mirror EXACTLY how the profile page fetches data
    const [
      { data: socialLinks },
      { data: customButtons },
      { data: profileBadges },
      { data: musicHistory },
      { data: badgeLoadout },
      { data: titleLoadout },
    ] = await Promise.all([
      admin.from('social_links').select('*').eq('user_id', userId).order('display_order'),
      admin.from('custom_buttons').select('*').eq('user_id', userId).order('display_order'),
      admin
        .from('profile_badges')
        .select(`badge_id, badges(id,name,icon,icon_url,color,background_color,glow_color,glow_strength,description,created_at)`)
        .eq('user_id', userId),
      // IMPORTANT: music_history is the correct table (not music_tracks)
      admin
        .from('music_history')
        .select('id, track_title, track_artist, track_url, track_type, added_at')
        .eq('user_id', userId)
        .order('added_at', { ascending: true })
        .limit(musicTrackLimit),
      admin
        .from('profile_badge_loadout')
        .select(`badge_id, position, display_order, badge:badges(id,name,icon,icon_url,color,background_color,glow_color,glow_strength,description,created_at)`)
        .eq('user_id', userId)
        .order('display_order', { ascending: true }),
      admin
        .from('profile_title_loadout')
        .select(`title_id, position, display_order, title:titles(id,name,color,created_at)`)
        .eq('user_id', userId)
        .order('display_order', { ascending: true }),
    ])

    // Use the central public sanitizer (same as app/[username]/page.tsx) so
    // this public endpoint can never leak owner-only fields like discord_id,
    // premium flags, or moderation state - a hand-rolled blocklist drifts.
    const safeProfile = sanitizeProfileForPublic(profile)

    const badges = (profileBadges || []).map((item: any) => item.badges).filter(Boolean)
    const resolvedBadgeLoadout = (badgeLoadout || []).filter((item: any) => item.badge)
    const resolvedTitleLoadout = (titleLoadout || []).filter((item: any) => item.title)

    // Map music_history fields → MusicTrack shape
    const musicTracks = (musicHistory || []).map((track: any) => ({
      id: track.id,
      title: track.track_title || '',
      artist: track.track_artist || '',
      url: track.track_url || '',
      type: track.track_type || 'direct',
    }))

    return NextResponse.json(
      {
        profile: safeProfile,
        socialLinks: socialLinks || [],
        customButtons: customButtons || [],
        badges,
        badgeLoadout: resolvedBadgeLoadout,
        titleLoadout: resolvedTitleLoadout,
        musicTracks,
      },
      { headers: { 'Cache-Control': 'no-store, private' } },
    )
  } catch (e: any) {
    console.error('[rez-panel] error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
