import { cache } from 'react'
import type { Viewport } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { GunsProfile } from '@/components/profile/guns-profile'
import { NewVisitorPopup } from '@/components/profile/new-visitor-popup'
import { TabTitleTypewriter } from '@/components/profile/tab-title-typewriter'
import { TrackView } from '@/components/profile/track-view'
import { isReservedUsername } from '@/lib/reserved-usernames'
import { UnclaimedUsernamePage } from '@/components/profile/unclaimed-username'

// Force-dynamic + revalidate:0 = every request re-hits our server so a
// transient 404 (e.g. someone visited halo.rip/foo before user `foo`
// registered) can't get cached by the CDN as a permanent 404.
export const dynamic = 'force-dynamic'
export const revalidate = 0
import { sanitizeProfileForPublic } from '@/lib/sanitize-profile'
import type { Profile } from '@/lib/types'


interface ProfilePageProps {
  params: Promise<{ username: string }>
}

// Next.js page-route params come through URL-encoded (`%2B_%2B` for `+_+`),
// unlike API-route params which are pre-decoded. We decode here so usernames
// with special characters resolve correctly.
function decodeUsername(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

async function findProfileByUsername<T>(
  admin: ReturnType<typeof createAdminClient>,
  rawUsername: string,
  selectCols: string,
): Promise<T | null> {
  const decoded = decodeUsername(rawUsername).toLowerCase()
  const { data } = await admin
    .from('profiles')
    .select(selectCols)
    .eq('username', decoded)
    .single()
  return (data as T) ?? null
}

type ProfileMetaShape = {
  username: string
  bio: string | null
  avatar_url: string | null
  display_name: string | null
  favicon_url: string | null
  embed_title: string | null
  embed_description: string | null
  embed_image_url: string | null
  embed_color: string | null
}

// React `cache()` dedupes within a single request. generateMetadata,
// generateViewport AND the page body all hit this, so the full profile row is
// read exactly ONCE per render (was 2: a small meta SELECT + a full SELECT *).
// Selecting `*` here (vs the old meta-only subset) lets the page body reuse it.
const getProfileForMeta = cache(async (rawUsername: string): Promise<(ProfileMetaShape & Record<string, any>) | null> => {
  const admin = createAdminClient()
  return findProfileByUsername<ProfileMetaShape & Record<string, any>>(admin, rawUsername, '*')
})

// Only return a valid 3/6-char hex; Next.js + Discord both choke on anything else.
function validHexColor(raw: string | null | undefined): string | undefined {
  return raw && /^#[0-9a-fA-F]{3,6}$/.test(raw) ? raw : undefined
}

export async function generateMetadata({ params }: ProfilePageProps) {
  const { username } = await params
  const profile = await getProfileForMeta(username)

  if (!profile) return { title: 'Profile Not Found' }

  const fallbackTitle = profile.display_name || profile.username || username
  const title = profile.embed_title || fallbackTitle
  const description =
    profile.embed_description || profile.bio || `Check out ${fallbackTitle}'s profile on halo.rip`
  const siteBase = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.halo.rip'
  const profileUrl = `${siteBase}/${profile.username || username}`
  // Custom embed image wins; otherwise use the avatar OG proxy.
  // Discord's media proxy decides whether to animate a GIF embed from the
  // URL's file extension, not the content type - so when the source is a GIF
  // we expose the proxy under a `.gif` path. Without it Discord shows a static
  // first frame even though the proxy streams the full animated bytes.
  const ogImageSource = profile.embed_image_url || profile.avatar_url || ''
  const isGifEmbed = /\.gif(\?|#|$)/i.test(ogImageSource)
  const ogProxyName = profile.username || username
  // External GIF hosts (Tenor, imgur, etc.) already end in `.gif`, so use them
  // directly. Locally-uploaded GIFs (avatar or custom embed image) are served
  // via `/api/file?pathname=...` whose path has no `.gif`, so we route them
  // through the `.gif` proxy path - the proxy resolves the embed image first,
  // then the avatar, and streams the raw animated bytes.
  const externalGif = isGifEmbed && profile.embed_image_url?.startsWith('http')
  let ogImage: string
  if (isGifEmbed && !externalGif) {
    ogImage = `${siteBase}/api/og-image/${ogProxyName}.gif`
  } else if (profile.embed_image_url) {
    ogImage = profile.embed_image_url.startsWith('http')
      ? profile.embed_image_url
      : `${siteBase}${profile.embed_image_url}`
  } else {
    ogImage = `${siteBase}/api/og-image/${ogProxyName}`
  }

  // NOTE: themeColor for the Discord embed accent strip lives on the
  // generateViewport export below, NOT here. Next.js silently drops it
  // from the metadata object - that's why custom Embed Color stopped working.

  return {
    title: `${title} | Halo`,
    description,
    ...(profile.favicon_url
      ? { icons: { icon: profile.favicon_url, shortcut: profile.favicon_url, apple: profile.favicon_url } }
      : {}),
    openGraph: {
      type: 'profile',
      url: profileUrl,
      title,
      description,
      images: [{ url: ogImage, width: 512, height: 512, alt: `${title}'s profile picture`, ...(isGifEmbed ? { type: 'image/gif' } : {}) }],
      siteName: 'halo.rip',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: ogImage, alt: `${title}'s profile picture` }],
    },
  }
}

// Per-profile Discord embed accent. Next.js merges this with the root
// layout's viewport export - when we omit themeColor here, the site-wide
// '#06060b' from app/layout.tsx is used instead.
export async function generateViewport({ params }: ProfilePageProps): Promise<Viewport> {
  const { username } = await params
  const profile = await getProfileForMeta(username)
  const themeColor = validHexColor(profile?.embed_color)
  return themeColor ? { themeColor } : {}
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params
  const admin = createAdminClient()

  // Reuse the cache()-deduped full row that generateMetadata/generateViewport
  // already fetched this request (one DB read instead of two). Clone before the
  // mutations below so we never mutate the shared cached object.
  const cachedProfile = await getProfileForMeta(username)
  const profile: any = cachedProfile ? { ...cachedProfile } : null
  if (!profile) {
    // No profile owns this handle. Before showing the generic 404,
    // check if the handle is even a valid signup format - if it is,
    // pivot the page into a "this username is unclaimed, grab it"
    // marketing CTA instead. Matches the signup-time regex
    // ^[a-z0-9_]+$ and the 1-30 length cap from check-username.
    // Reserved names (api, dashboard, etc.) AND malformed handles
    // both fall through to notFound() so we never advertise a name
    // that signup would later reject.
    const lower = username.toLowerCase()
    const looksValid = /^[a-z0-9_]{1,30}$/.test(lower) && !isReservedUsername(lower)
    if (looksValid) {
      return <UnclaimedUsernamePage username={lower} />
    }
    notFound()
  }

  // profile.id is now the user's auth id
  const userId = profile.id

  // "Use Discord Avatar" override - when the owner toggled this on
  // AND we have a cached Discord avatar URL from the OAuth callback,
  // swap that in as the rendered avatar before sanitization. We do
  // this at the page level instead of inside GunsProfile because the
  // avatar appears in 6+ render branches and threading the override
  // through each one would be brittle.
  if (profile.use_discord_avatar && profile.discord_avatar_url) {
    profile.avatar_url = profile.discord_avatar_url
  }

  // Audio Manager limits: premium users get 5 rotating tracks, free get 3.
  // Mirror the same constants used by app/api/music/route.ts so the public
  // profile and the dashboard agree on how many songs render.
  const musicTrackLimit = profile.premium_active ? 5 : 3

  const [
    { data: socialLinks },
    { data: customButtons },
    { data: profileBadges },
    { data: musicTracks },
    { data: badgeLoadout },
    { data: titleLoadout },
  ] = await Promise.all([
    admin.from('social_links').select('*').eq('user_id', userId).order('display_order'),
    admin.from('custom_buttons').select('*').eq('user_id', userId).order('display_order'),
    admin
      .from('profile_badges')
      .select(`
        badge_id,
        badges (
          id,
          name,
          icon,
          icon_url,
          color,
          background_color,
          glow_color,
          glow_strength,
          description,
          created_at
        )
      `)
      .eq('user_id', userId),
    admin
      .from('music_history')
      .select('id, track_title, track_artist, track_url, track_type, cover_url, display_as_record, spin_record, lyrics, external_url, added_at')
      .eq('user_id', userId)
      .order('added_at', { ascending: true })
      .limit(musicTrackLimit),
    admin
      .from('profile_badge_loadout')
      .select(`
        badge_id,
        position,
        display_order,
        badge:badges (
          id,
          name,
          icon,
          icon_url,
          color,
          background_color,
          glow_color,
          glow_strength,
          description,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('display_order', { ascending: true }),
    admin
      .from('profile_title_loadout')
      .select(`
        title_id,
        position,
        display_order,
        title:titles (
          id,
          name,
          color,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('display_order', { ascending: true }),
  ])

  const badges = profileBadges?.map((item: any) => item.badges).filter(Boolean) || []
  // profile_badges is the source of truth for ownership. Only render equipped
  // badges the user actually owns - otherwise a revoked badge (e.g. a rank
  // badge lost when dropping out of the leaderboard top 3) could be re-equipped
  // from a saved profile preset and keep showing.
  const ownedBadgeIds = new Set((profileBadges || []).map((item: any) => item.badge_id))
  // Supabase types the joined `badge` / `title` as an array even though
  // it's a 1:1 relation; flatten so the shape matches ProfileBadgeLoadoutItem
  // / ProfileTitleLoadoutItem expected by GunsProfile.
  const resolvedBadgeLoadout = (badgeLoadout || [])
    .filter((item: any) => item.badge && ownedBadgeIds.has(item.badge_id))
    .map((item: any) => ({ ...item, badge: Array.isArray(item.badge) ? item.badge[0] : item.badge }))
  const resolvedTitleLoadout = (titleLoadout || [])
    .filter((item: any) => item.title)
    .map((item: any) => ({ ...item, title: Array.isArray(item.title) ? item.title[0] : item.title }))

  // Staff can override (force a specific number) or lock (freeze current count)
  const overrideViews = (profile as any).views_override as number | null | undefined
  const viewsLocked   = (profile as any).views_locked === true
  const viewCount     = typeof overrideViews === 'number' ? overrideViews : (profile.view_count || 0)

  // ────────────────────── View tracking ──────────────────────
  //
  // Moved client-side. The <TrackView/> component mounted below fires
  // a POST to /api/track-view 3.5 s after the page becomes visible
  // (sessionStorage-deduped per tab, visibility-checked). Bots that
  // GET the page URL without running JS never trigger the request,
  // which kills the simplest view-bombing approach dead. The server
  // route applies the full layered defence (bot UA filter, Tor
  // filter, cookie + subnet hash dedup, hourly per-profile velocity
  // cap). See components/profile/track-view.tsx + /api/track-view.

  const safeProfile = sanitizeProfileForPublic(profile)

  // Custom click + entrance sounds are premium-only. premium_active is stripped
  // from the public profile by the sanitizer above, so gate the URLs here on the
  // server (where premium_active is still readable) instead of in the client
  // renderer. Non-premium profiles get the URLs nulled so nothing plays.
  if (!profile.premium_active) {
    ;(safeProfile as any).click_sound_url = null
    ;(safeProfile as any).enter_sound_url = null
    // Custom fonts are premium-only and the whole Fonts section is PRO-locked
    // in customize - so once a free-event premium lapses, a stuck custom font
    // can't be removed from the UI. Null the font fields here so a non-premium
    // profile renders the default font (reverts cleanly, no user action needed).
    ;(safeProfile as any).font_family = null
    ;(safeProfile as any).custom_font_url = null
    ;(safeProfile as any).font_1_url = null
    ;(safeProfile as any).font_2_url = null
    ;(safeProfile as any).font_3_url = null
    ;(safeProfile as any).font_4_url = null
  }

  // Tab typewriter just shows the handle, e.g. "@rez". Falls back to the
  // raw param if the row somehow has no username.
  const tabTitle = `@${profile.username || username}`

  return (
    <>
      <TabTitleTypewriter title={tabTitle} prefix="@" />
      <NewVisitorPopup ownerUsername={safeProfile.username || username} />
      {/* Client-side view tracker. Only fires for real browsers that
          actually load the page and stay 3.5s+; bots that hammer the
          URL never trigger it. Skip when staff override / lock is
          set so we don't pollute synthetic counts. */}
      {!viewsLocked && typeof overrideViews !== 'number' && (
        <TrackView profileId={profile.id} />
      )}
      <GunsProfile
        profile={{ ...safeProfile, view_count: viewCount } as Profile}
        socialLinks={socialLinks || []}
        badges={badges}
        badgeLoadout={resolvedBadgeLoadout}
        titleLoadout={resolvedTitleLoadout}
        customButtons={customButtons || []}
        musicTracks={(musicTracks || []).map((track: any) => ({
          id: track.id,
          title: track.track_title || '',
          artist: track.track_artist || '',
          url: track.track_url || '',
          type: track.track_type || 'direct',
          cover_url: track.cover_url || null,
          display_as_record: track.display_as_record || false,
          spin_record: track.spin_record || false,
          lyrics: track.lyrics || null,
          external_url: track.external_url || null,
        }))}
      />
    </>
  )
}
