import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/** Only allow `next` to be a local path - never a remote URL.
 *  Blocks open-redirect phishing via /auth/callback?next=//evil.com */
function safeNext(raw: string | null): string {
  const candidate = raw ?? '/dashboard'
  // Must start with a single '/' and not '//' (protocol-relative) or '/\\'
  // (backslash-protocol-relative; some browsers normalise '\\' to '/').
  if (
    candidate.startsWith('/') &&
    !candidate.startsWith('//') &&
    !candidate.startsWith('/\\')
  ) {
    return candidate
  }
  return '/dashboard'
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=verification_failed`)
}
