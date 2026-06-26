import { NextResponse } from 'next/server'

/**
 * Legacy /security.txt → /.well-known/security.txt
 *
 * RFC 9116 mandates /.well-known/security.txt as the canonical
 * location, but many older scanners + curl one-liners still hit
 * /security.txt directly. 301-redirect to the canonical so the
 * file lives in exactly one place.
 */
export const dynamic = 'force-static'

export async function GET() {
  return NextResponse.redirect('https://halo.rip/.well-known/security.txt', 301)
}
