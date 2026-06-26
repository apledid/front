export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getApiUserId } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const rl = await withRateLimit(request, 'general')
    if (rl.response) return rl.response

    const currentUserId = await getApiUserId()

    if (!currentUserId) return NextResponse.json({ badges: [] })

    // Only allow fetching your own badges - no IDOR
    const userId = currentUserId

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('profile_badges')
      .select(`
        badge_id,
        badges (
          id,
          name,
          icon,
          color,
          description,
          created_at,
          icon_url,
          background_color,
          glow_color
        )
      `)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ badges: [] })
    }
    
    const badges = (data || []).map((item: any) => item.badges).filter(Boolean)
    return NextResponse.json({ badges })
  } catch (error) {
    return NextResponse.json({ badges: [] })
  }
}
