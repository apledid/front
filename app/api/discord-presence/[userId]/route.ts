/**
 * Discord presence read endpoint - the in-house Lanyard replacement.
 *
 * Returns the latest presence snapshot the Discord bot wrote to
 * `public.discord_presence` for the requested user. The bot
 * subscribes to presenceUpdate events in halo.rip's main Discord
 * server and upserts whenever a user's status or activity changes;
 * see discord-bot/src/events/presence-update.js.
 *
 * Response shape MATCHES the relevant slice of Lanyard's response so
 * the widget fetcher (app/api/widgets/fetch/route.ts) can swap the
 * URL without touching the renderer. Schema:
 *
 *   {
 *     "success": true,
 *     "data": {
 *       "discord_user": { id, username, global_name, avatar },
 *       "discord_status": "online" | "idle" | "dnd" | "offline",
 *       "activities": [...],
 *       "spotify": { song, artist, album, ... } | null
 *     }
 *   }
 *
 * When the user isn't tracked (not in halo.rip's server / bot
 * hasn't seen them yet), we return success: false with a clear
 * message the widget can surface as "join discord.gg/NgVh45gXbD".
 *
 * Cache-Control is short (15s) because presence updates are
 * roughly real-time - anything longer makes the widget feel stale.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const SNOWFLAKE_RE = /^\d{17,20}$/

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  // Per-IP rate limit. Each request is an unauthenticated DB read,
  // and the URL-keyed cache only kicks in for the 15s window after a
  // miss. Without this, a scraper iterating Discord snowflakes can
  // generate one PostgREST query per request bypassing the cache
  // because each URL is different. 60/min/IP is generous for any
  // legitimate visitor.
  const rl = await withRateLimit(request, 'general')
  if (rl.response) return rl.response

  const { userId } = await context.params

  if (!SNOWFLAKE_RE.test(userId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid Discord user ID' },
      { status: 400 },
    )
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('discord_presence')
      .select('status, discord_user, activities, spotify, updated_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[discord-presence] DB error:', error)
      return NextResponse.json(
        { success: false, error: 'Lookup failed' },
        { status: 500 },
      )
    }

    if (!data) {
      // User isn't being tracked - they aren't in halo.rip's
      // Discord server (or the bot hasn't seen their presence yet).
      // The widget renderer maps this error message into "Join
      // discord.gg/NgVh45gXbD to enable status tracking".
      return NextResponse.json(
        {
          success: false,
          error: 'not_tracked',
          message: 'User not in halo.rip Discord - join discord.gg/NgVh45gXbD',
        },
        { status: 404, headers: { 'Cache-Control': 'public, s-maxage=30' } },
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          discord_user: data.discord_user,
          discord_status: data.status,
          activities: data.activities,
          spotify: data.spotify,
          updated_at: data.updated_at,
        },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=15' } },
    )
  } catch (error) {
    console.error('[discord-presence] error:', error)
    return NextResponse.json(
      { success: false, error: 'Lookup failed' },
      { status: 500 },
    )
  }
}
