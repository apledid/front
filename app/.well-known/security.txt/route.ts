import { NextResponse } from 'next/server'

/**
 * RFC 9116 security.txt
 *
 * Public contact for security researchers. Plain text per the RFC,
 * served with text/plain so curl + browsers + scanners all parse it
 * correctly. Expires in 1 year - update this file before then.
 */
const SECURITY_TXT = `Contact: mailto:security@halo.rip
Contact: https://discord.gg/NgVh45gXbD
Expires: 2027-05-23T00:00:00.000Z
Preferred-Languages: en
Canonical: https://halo.rip/.well-known/security.txt
Policy: https://halo.rip/tos

# Scope
# halo.rip and all *.halo.rip subdomains are in scope. Out of scope:
#   - User-uploaded content (responsibility of the uploading user)
#   - Third-party services we integrate with (Discord, Stripe, Cloudflare, etc.)
#   - Social-engineering of staff or users
#   - DoS / volumetric attacks
#
# Bring a working PoC for anything you report. Bounties are case-by-
# case for confirmed RCE / auth bypass / mass IDOR / stored XSS. We
# do not currently run a formal bug bounty program.
`

export const dynamic = 'force-static'

export async function GET() {
  return new NextResponse(SECURITY_TXT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
