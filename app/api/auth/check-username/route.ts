import { NextRequest, NextResponse } from "next/server"
import { withRateLimit } from '@/lib/rate-limit'
import { createAdminClient } from "@/lib/supabase/admin"
import { isReservedUsername } from "@/lib/reserved-usernames"
import { isBannedUsername } from "@/lib/banned-username-terms"

export async function GET(request: NextRequest) {
  // Rate limit: 10 username checks per minute per IP
  const rateLimit = await withRateLimit(request, 'checkUsername')
  if (rateLimit.response) return rateLimit.response

  const username = request.nextUrl.searchParams.get("username")

  if (!username) {
    return NextResponse.json({ available: false })
  }

  // Basic validation: only allow alphanumeric + underscores, 3-20 chars
  if (!/^[a-zA-Z0-9_]{1,30}$/.test(username)) {
    return NextResponse.json({ available: false })
  }

  // Reserved (route-shadowing) and banned (CSAM/slur) handles report as
  // unavailable so the UI greys out the Claim button before submit. The
  // signup endpoints re-check server-side, so this is just UX - a probe
  // here can't reveal anything sensitive.
  if (isReservedUsername(username) || isBannedUsername(username)) {
    return NextResponse.json({ available: false })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username.toLowerCase())
    .maybeSingle()

  if (error) {
    console.error("Check username error:", error)
    return NextResponse.json({ available: false })
  }

  return NextResponse.json({ available: !data })
}
