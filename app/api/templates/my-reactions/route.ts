/**
 * Returns the set of template IDs the current user has liked + favorited.
 *
 * The dashboard hydrates its likedSet / favoritedSet on mount from this
 * endpoint so the heart + star fill state survives page reloads. Without
 * it, every template card renders with empty heart / star on load, and
 * the user can't tell which ones they've already reacted to (and could
 * even toggle a like off accidentally thinking they were toggling it on).
 *
 * Lightweight - just two ID lists. Cached briefly so rapid navigations
 * don't hammer the DB.
 */

import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'

export async function GET(request: Request) {
  try {
    const rl = await withRateLimit(request, 'general')
    if (rl.response) return rl.response

    const profile = await getApiUser()
    if (!profile) {
      // Not an error - unauthenticated visitors just get empty sets so
      // the dashboard can still render the public library.
      return NextResponse.json({ liked: [], favorited: [] })
    }

    const admin = createAdminClient()
    const [likesRes, favsRes] = await Promise.all([
      admin.from('template_likes').select('template_id').eq('user_id', profile.id),
      admin.from('template_favorites').select('template_id').eq('user_id', profile.id),
    ])

    const liked = (likesRes.data || []).map((r: any) => r.template_id as string)
    const favorited = (favsRes.data || []).map((r: any) => r.template_id as string)

    return NextResponse.json({ liked, favorited })
  } catch (error: any) {
    // Fall back to empty sets rather than 500 - a transient DB error
    // shouldn't blank the whole dashboard. The UI degrades to "looks
    // like you've never liked anything" which is recoverable.
    console.error('[templates/my-reactions] error:', error)
    return NextResponse.json({ liked: [], favorited: [] })
  }
}
