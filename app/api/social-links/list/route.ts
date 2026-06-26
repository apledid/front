import { NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { withRateLimit } from "@/lib/rate-limit"

export async function GET(request: Request) {
  try {
    const rl = await withRateLimit(request, 'general')
    if (rl.response) return rl.response

    const profile = await getApiUser()

    if (!profile) {
      return NextResponse.json({ links: [] })
    }

    const supabase = createAdminClient()
    // icon_url + label are required for custom links so the renderer
    // can show the user's uploaded icon (and their chosen label as
    // alt text / tooltip). Without them, every custom link falls back
    // to the default chain icon - which is what was happening on the
    // dashboard Live Preview.
    const { data: links, error } = await supabase
      .from("social_links")
      .select("id, platform, url, label, icon_url, display_order, created_at")
      .eq("user_id", profile.id)
      .order("display_order")

    if (error) {
      return NextResponse.json({ links: [] })
    }

    return NextResponse.json({ links: links || [] })
  } catch (error) {
    return NextResponse.json({ links: [] })
  }
}
