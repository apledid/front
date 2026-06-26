import { NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { withRateLimit } from '@/lib/rate-limit'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const queriedUserId = url.searchParams.get('userId')

    const supabase = createAdminClient()
    let targetUserId: string | null = null

    if (queriedUserId) {
      // Validate UUID format to prevent enumeration/injection
      if (!UUID_REGEX.test(queriedUserId)) {
        return NextResponse.json({ widgets: [] })
      }
      // Public fetch for profile rendering - only return enabled widgets.
      targetUserId = queriedUserId
    } else {
      const profile = await getApiUser()
      if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      targetUserId = profile.id
    }

    let query = supabase
      .from("widgets")
      .select("*")
      .eq("user_id", targetUserId)
      .order("display_order")
    if (queriedUserId) query = query.eq('enabled', true)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ widgets: data || [] })
  } catch {
    return NextResponse.json({ error: "Failed to fetch widgets" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { type, config, display_order } = await request.json()
    if (!type) return NextResponse.json({ error: "Widget type required" }, { status: 400 })

    const supabase = createAdminClient()
    const { count } = await supabase
      .from("widgets")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", profile.id)
    if ((count || 0) >= 10) {
      return NextResponse.json({ error: "You can only have up to 10 widgets" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("widgets")
      .insert({
        user_id: profile.id,
        type,
        config: config || {},
        display_order: display_order ?? 0,
        enabled: true,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    // Close the count-then-insert race: undo if a concurrent insert exceeded the cap.
    const { count: after } = await supabase
      .from("widgets")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", profile.id)
    if ((after || 0) > 10 && data) {
      await supabase.from("widgets").delete().eq("id", (data as { id: string }).id)
      return NextResponse.json({ error: "You can only have up to 10 widgets" }, { status: 400 })
    }
    return NextResponse.json({ widget: data })
  } catch {
    return NextResponse.json({ error: "Failed to create widget" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { id } = body

    // Whitelist only safe fields - prevent mass assignment
    const updates: Record<string, unknown> = {}
    if (body.config !== undefined) updates.config = body.config
    if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled)
    if (body.display_order !== undefined) updates.display_order = Number(body.display_order) || 0

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("widgets")
      .update(updates)
      .eq("id", id)
      .eq("user_id", profile.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ widget: data })
  } catch {
    return NextResponse.json({ error: "Failed to update widget" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await request.json()
    const supabase = createAdminClient()
    const { error } = await supabase
      .from("widgets")
      .delete()
      .eq("id", id)
      .eq("user_id", profile.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete widget" }, { status: 500 })
  }
}
