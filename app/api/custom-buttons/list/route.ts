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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: buttons, error } = await supabase
      .from("custom_buttons")
      .select("*")
      .eq("user_id", profile.id)
      .order("display_order")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ buttons: buttons || [] })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch buttons" }, { status: 500 })
  }
}
