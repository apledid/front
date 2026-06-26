import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { timingSafeEqual } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { createAdminClient } from '@/lib/supabase/admin'
import { getApiUser, generateSessionToken, hashToken } from '@/lib/api-auth'
import { withRateLimit, getClientIp } from '@/lib/rate-limit'
import { isBannedUsername } from '@/lib/banned-username-terms'
import { isSignupIpAtLimit } from '@/lib/account-limits'

function getAppUrl(request: Request): string {
  // 1. Explicit env var always wins
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  // 2. Railway/Cloudflare sets x-forwarded-host to the public hostname
  // Normalise: strip bare "halo.rip" → "www.halo.rip" so the redirect lands correctly
  const fwdHost = request.headers.get('x-forwarded-host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  if (fwdHost) {
    const host = fwdHost === 'halo.rip' ? 'www.halo.rip' : fwdHost
    return `${proto}://${host}`
  }
  // 3. Last resort: use request origin (works in local dev)
  return new URL(request.url).origin
}

/** Match the domain attribute we used in /api/auth/discord when setting
 *  the state cookie - otherwise the clear here is a no-op against a
 *  parent-domain cookie and the state cookie persists past the flow. */
function stateCookieDomain(appUrl: string): string | undefined {
  try {
    const host = new URL(appUrl).hostname
    if (host === 'halo.rip' || host.endsWith('.halo.rip')) return '.halo.rip'
  } catch {}
  return undefined
}

function redirect(appUrl: string, path: string, clearState = true): NextResponse {
  const res = NextResponse.redirect(`${appUrl}${path}`)
  if (clearState) {
    const domain = stateCookieDomain(appUrl)
    res.cookies.set('discord_oauth_state', '', {
      maxAge: 0,
      path: '/',
      ...(domain ? { domain } : {}),
    })
  }
  return res
}

/** Create a 7-day session and return a redirect response to /dashboard */
async function sessionRedirect(
  appUrl: string,
  userId: string,
  request: Request,
): Promise<NextResponse> {
  const admin = createAdminClient()
  const rawToken = generateSessionToken()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await admin.from('sessions').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    ip_address: getClientIp(request),
    user_agent: request.headers.get('user-agent') ?? null,
  })

  // Scope session cookies to .halo.rip (matching the state cookie
  // and lib/create-session.ts) so they're valid on both halo.rip and
  // www.halo.rip. Without this, the Discord-OAuth callback redirected
  // users to /dashboard with cookies pinned to whichever host the
  // callback ran on, and they'd get logged out the moment they
  // navigated to the other host.
  const stateDomain = stateCookieDomain(appUrl)
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    ...(stateDomain ? { domain: stateDomain } : {}),
  }

  const res = NextResponse.redirect(`${appUrl}/dashboard`)
  res.cookies.set('discord_oauth_state', '', {
    maxAge: 0,
    path: '/',
    ...(stateDomain ? { domain: stateDomain } : {}),
  })
  res.cookies.set('session_token', rawToken, cookieOpts)
  res.cookies.set('user_id', userId, cookieOpts)
  res.cookies.set('session_created_at', new Date().toISOString(), cookieOpts)
  return res
}

export async function GET(request: Request) {
  const rl = await withRateLimit(request, 'login')
  if (rl.response) return rl.response

  const appUrl = getAppUrl(request)
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')

  if (!code || !stateParam) return redirect(appUrl, '/login?error=discord_cancelled')

  // Validate CSRF state
  const jar = await cookies()
  const savedState = jar.get('discord_oauth_state')?.value
  const colonIdx = stateParam.lastIndexOf(':')
  const state = stateParam.slice(0, colonIdx)
  const action = stateParam.slice(colonIdx + 1) // 'login' | 'connect' | 'signup'

  // Timing-safe comparison. State is 128 bits of randomBytes so a
  // timing leak isn't practically exploitable here, but matches the
  // hygiene used everywhere else session-token / password-equivalent
  // comparisons happen. Lengths must match before timingSafeEqual or
  // it throws.
  const stateMatches = (() => {
    if (!savedState || savedState.length !== state.length) return false
    try {
      return timingSafeEqual(Buffer.from(savedState), Buffer.from(state))
    } catch {
      return false
    }
  })()
  if (!stateMatches) return redirect(appUrl, '/login?error=discord_state_mismatch')

  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  if (!clientId || !clientSecret) return redirect(appUrl, '/login?error=discord_not_configured')

  const redirectUri = `${appUrl}/api/auth/discord/callback`

  // Exchange code for access token
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })
  if (!tokenRes.ok) return redirect(appUrl, '/login?error=discord_token_failed')
  const { access_token } = await tokenRes.json()

  // Fetch Discord user
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!userRes.ok) return redirect(appUrl, '/login?error=discord_user_failed')
  const discordUser = await userRes.json()
  const discordId: string = discordUser.id

  // Build the CDN URL for the user's avatar. Discord returns just the
  // hash (e.g. "a_1234abc" for animated, "1234abc" for static); the
  // canonical URL is /avatars/<id>/<hash>.<ext>. Hashes prefixed with
  // "a_" indicate APNG/animated which Discord serves as .gif. Users
  // without a custom avatar return null - in that case fall back to
  // null so the toggle UI keeps the option disabled instead of pinning
  // the embed default-avatar.
  const discordAvatarHash: string | null = discordUser.avatar ?? null
  const discordAvatarUrl: string | null = discordAvatarHash
    ? `https://cdn.discordapp.com/avatars/${discordId}/${discordAvatarHash}.${discordAvatarHash.startsWith('a_') ? 'gif' : 'png'}?size=512`
    : null

  const admin = createAdminClient()

  // ── CONNECT mode: link Discord to the currently authenticated account ──
  if (action === 'connect') {
    const profile = await getApiUser()
    if (!profile) return redirect(appUrl, '/login')

    // Check if this Discord account is already linked to another user
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('discord_id', discordId)
      .maybeSingle()

    if (existing && existing.id !== profile.id) {
      return redirect(appUrl, '/dashboard/settings?discord=already_linked')
    }

    // Persist both the Discord ID and the avatar URL. We capture the
    // URL at link time so the dashboard's "Use Discord Avatar" toggle
    // has something to render without us needing to keep an OAuth
    // refresh token around. If the user changes their Discord avatar
    // later they re-connect to refresh.
    await admin
      .from('profiles')
      .update({ discord_id: discordId, discord_avatar_url: discordAvatarUrl })
      .eq('id', profile.id)
    return redirect(appUrl, '/dashboard/settings?discord=connected')
  }

  // ── SIGNUP mode: find existing account OR create a new one ──
  if (action === 'signup') {
    const { data: existing } = await admin
      .from('profiles')
      .select('id, banned, ban_reason')
      .eq('discord_id', discordId)
      .maybeSingle()

    // Already has an account (this Discord is linked) - just log them in
    if (existing) {
      if (existing.banned) return redirect(appUrl, '/login?error=discord_banned')
      return sessionRedirect(appUrl, existing.id, request)
    }

    // ── Duplicate-account guard (the boka bug) ──────────────────────
    // No account matched by discord_id. Before creating a NEW account,
    // check whether an existing account already uses this person's
    // Discord email. This is the case where someone signed up with
    // email first, never linked Discord, then later clicks "sign in
    // with Discord" - we used to spawn a second orphan account
    // (@boka + @svrsicu). Now we LINK the Discord to the existing
    // account and log them into it instead.
    //
    // Safety rails:
    //   - Only trust the Discord email when Discord marks it verified,
    //     so a spoofed unverified email can't be used to claim someone
    //     else's halo account.
    //   - Only auto-link when the target account has NO discord_id yet.
    //     If it already has a different Discord linked, we don't touch
    //     it - fall through to creating a fresh account instead.
    const discordEmail =
      typeof discordUser.email === 'string' && discordUser.verified === true
        ? discordUser.email.toLowerCase().trim()
        : null
    if (discordEmail) {
      const { data: byEmail } = await admin
        .from('profiles')
        .select('id, banned, discord_id')
        .eq('email', discordEmail)
        .maybeSingle()
      if (byEmail && !byEmail.discord_id) {
        if (byEmail.banned) return redirect(appUrl, '/login?error=discord_banned')
        await admin
          .from('profiles')
          .update({ discord_id: discordId, discord_avatar_url: discordAvatarUrl })
          .eq('id', byEmail.id)
        return sessionRedirect(appUrl, byEmail.id, request)
      }
    }

    // No account yet - create one from Discord info
    let rawBase = (discordUser.username || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 20) || 'user'

    // If the Discord username itself contains a banned term (CSAM/slur),
    // don't propagate it into a halo handle. Fall back to a neutral
    // uid-suffixed handle ("user_<random>"). The user can rename later
    // via the normal (filtered) flow if they want.
    if (isBannedUsername(rawBase)) {
      console.warn(`[discord-signup] discord username "${discordUser.username}" hit banned filter, using fallback handle`)
      rawBase = 'user' + Math.floor(1000 + Math.random() * 9000)
    }

    // Find a unique username
    let username = rawBase
    for (let i = 1; i <= 20; i++) {
      const { data: taken } = await admin
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()
      if (!taken) break
      const suffix = String(i).padStart(2, '0')
      username = rawBase.slice(0, 18) + suffix
    }

    // Per-IP account cap (shared across all signup paths). Only applies to a
    // genuinely NEW account - existing-account login + email auto-link above
    // have already returned, so this never blocks someone signing back in.
    const ip = getClientIp(request)
    if (await isSignupIpAtLimit(admin, ip)) {
      return redirect(appUrl, '/signup?error=account_limit')
    }

    const userId = uuidv4()
    const displayName = (discordUser.global_name || discordUser.username || username).slice(0, 50)

    const { data: newProfile, error: profileError } = await admin
      .from('profiles')
      .insert({
        id: userId,
        username,
        display_name: displayName,
        discord_id: discordId,
        signup_ip: ip !== 'unknown' ? ip : null,
        // Persist Discord avatar URL at signup so the new account can
        // immediately flip on the "Use Discord Avatar" toggle without
        // re-connecting. Null when the user has no custom Discord
        // avatar; the dashboard toggle stays disabled in that case.
        discord_avatar_url: discordAvatarUrl,
        email_verified: true,
        enter_title: username,
        enter_subtitle: 'Click anywhere to enter',
        enter_enabled: true,
        music_show_title: true,
        music_show_artist: true,
        show_views: true,
        layout_style: 'floating',
        card_style: 'classic',
        content_alignment: 'center',
      })
      .select('uid')
      .single()

    if (profileError || !newProfile) {
      console.error('[Discord Signup] Profile creation failed:', profileError)
      // DB-level per-IP cap trigger fired (race past the app check above).
      if (profileError?.message?.includes('account_limit_per_ip')) {
        return redirect(appUrl, '/signup?error=account_limit')
      }
      return redirect(appUrl, '/signup?error=discord_signup_failed')
    }

    // Give OG badge to users with UID < 1000. Tightened from the
    // original <= 1500 threshold to match the 2026-05 backfill cutoff
    // the owner asked for.
    if (newProfile.uid && newProfile.uid < 1000) {
      const { data: ogBadge } = await admin
        .from('badges')
        .select('id')
        .ilike('name', '%og%')
        .maybeSingle()
      if (ogBadge) {
        const { error: ogErr } = await admin
          .from('profile_badges')
          .insert({ user_id: userId, badge_id: ogBadge.id })
        if (ogErr) console.warn('[Discord Signup] OG badge grant failed:', ogErr.message)
      }
    }

    return sessionRedirect(appUrl, userId, request)
  }

  // ── LOGIN mode: find profile by discord_id and create a session ──
  const { data: profile } = await admin
    .from('profiles')
    .select('id, banned, ban_reason')
    .eq('discord_id', discordId)
    .maybeSingle()

  if (!profile) return redirect(appUrl, '/login?error=discord_not_linked')
  if (profile.banned) return redirect(appUrl, '/login?error=discord_banned')

  // Opportunistically refresh the stored Discord avatar URL on every
  // login. We don't keep an OAuth refresh token around so this is the
  // only moment the user's avatar would otherwise go stale. Fire-and-
  // forget - a failed update can't block login.
  admin
    .from('profiles')
    .update({ discord_avatar_url: discordAvatarUrl })
    .eq('id', profile.id)
    .then(() => {})

  return sessionRedirect(appUrl, profile.id, request)
}
