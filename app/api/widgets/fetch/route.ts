import { NextResponse } from "next/server"
import { withRateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

// Public widget data fetcher - used by profile pages to render widget content live.
// No auth required (data is public). Rate-limited to prevent external API abuse.

export const dynamic = 'force-dynamic'

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchGitHub(username: string) {
  const [user, repos] = await Promise.all([
    fetchJson(`https://api.github.com/users/${encodeURIComponent(username)}`),
    fetchJson(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=5`),
  ])
  return {
    username: user.login,
    avatar: user.avatar_url,
    name: user.name,
    bio: user.bio,
    followers: user.followers,
    following: user.following,
    public_repos: user.public_repos,
    repos: (repos as any[]).map(r => ({
      name: r.name,
      description: r.description,
      stars: r.stargazers_count,
      language: r.language,
      url: r.html_url,
    })),
  }
}

async function fetchLastFm(username: string) {
  const key = process.env.LASTFM_API_KEY
  if (!key) throw new Error('Last.fm API key not configured')
  const [recent, user] = await Promise.all([
    fetchJson(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(username)}&api_key=${key}&format=json&limit=5`),
    fetchJson(`https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${encodeURIComponent(username)}&api_key=${key}&format=json`),
  ])
  const tracks = recent?.recenttracks?.track || []
  return {
    username,
    playcount: user?.user?.playcount,
    avatar: user?.user?.image?.[2]?.['#text'],
    nowPlaying: tracks[0]?.['@attr']?.nowplaying === 'true' ? {
      title: tracks[0].name,
      artist: tracks[0].artist?.['#text'],
      image: tracks[0].image?.[2]?.['#text'],
      url: tracks[0].url,
    } : null,
    recent: tracks.slice(0, 5).map((t: any) => ({
      title: t.name,
      artist: t.artist?.['#text'],
      image: t.image?.[2]?.['#text'],
      url: t.url,
    })),
  }
}

async function fetchRoblox(userId: string) {
  const [user, thumb, friends, followers, following, presence] = await Promise.all([
    fetchJson(`https://users.roblox.com/v1/users/${encodeURIComponent(userId)}`),
    fetchJson(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(userId)}&size=150x150&format=Png`),
    fetchJson(`https://friends.roblox.com/v1/users/${encodeURIComponent(userId)}/friends/count`).catch(() => null),
    fetchJson(`https://friends.roblox.com/v1/users/${encodeURIComponent(userId)}/followers/count`).catch(() => null),
    fetchJson(`https://friends.roblox.com/v1/users/${encodeURIComponent(userId)}/followings/count`).catch(() => null),
    fetch(`https://presence.roblox.com/v1/presence/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: [Number(userId)] }),
      next: { revalidate: 60 },
    }).then(r => r.ok ? r.json() : null).catch(() => null),
  ])
  const p = presence?.userPresences?.[0]
  const presenceTypes: Record<number, string> = { 0: 'Offline', 1: 'Online', 2: 'In Game', 3: 'In Studio', 4: 'Invisible' }
  return {
    id: user.id,
    name: user.name,
    displayName: user.displayName,
    description: user.description,
    created: user.created,
    avatar: thumb?.data?.[0]?.imageUrl,
    friends: friends?.count ?? null,
    followers: followers?.count ?? null,
    following: following?.count ?? null,
    presence: p ? {
      type: presenceTypes[p.userPresenceType] || 'Offline',
      typeId: p.userPresenceType,
      location: p.lastLocation,
      placeId: p.placeId,
      lastOnline: p.lastOnline,
    } : null,
    profileUrl: `https://www.roblox.com/users/${userId}/profile`,
  }
}

async function fetchValorant(username: string, tag: string) {
  const apiKey = process.env.HENRIKDEV_API_KEY
  const authHeaders: Record<string, string> = apiKey ? { Authorization: apiKey } : {}

  // Account info - works without key on v1
  const data = await fetchJson(
    `https://api.henrikdev.xyz/valorant/v1/account/${encodeURIComponent(username)}/${encodeURIComponent(tag)}`,
    { headers: authHeaders },
  )
  if (!data?.data) throw new Error('Player not found')
  const region = data.data.region || 'eu'

  // MMR - try v2 (richer data, needs key), fall back to v1 (no key needed)
  let mmr: any = null
  try {
    mmr = await fetchJson(
      `https://api.henrikdev.xyz/valorant/v2/mmr/${region}/${encodeURIComponent(username)}/${encodeURIComponent(tag)}`,
      { headers: authHeaders },
    )
  } catch {
    // v2 failed (likely 401 - no key). Try v1.
    try {
      mmr = await fetchJson(
        `https://api.henrikdev.xyz/valorant/v1/mmr/${region}/${encodeURIComponent(username)}/${encodeURIComponent(tag)}`,
      )
      // Normalise v1 shape to v2 shape so the rest of the code works
      if (mmr?.data) mmr = { data: { current_data: mmr.data } }
    } catch {
      mmr = null
    }
  }

  const mmrData = mmr?.data?.current_data
  return {
    name: data.data.name,
    tag: data.data.tag,
    region,
    card: data.data.card?.large,
    level: data.data.account_level,
    rank: mmrData?.currenttierpatched,
    rr: mmrData?.ranking_in_tier,
    elo: mmrData?.elo,
    rankIcon: mmrData?.images?.large ?? mmrData?.images?.small ?? null,
  }
}

async function fetchChess(username: string) {
  const [profile, stats] = await Promise.all([
    fetchJson(`https://api.chess.com/pub/player/${encodeURIComponent(username)}`),
    fetchJson(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`),
  ])
  return {
    username: profile.username,
    avatar: profile.avatar,
    name: profile.name,
    title: profile.title || null,      // FIDE title: GM, IM, etc.
    league: profile.league || null,    // chess.com league: Wood, Stone, Bronze, etc.
    followers: profile.followers ?? null,
    country: profile.country,
    rapid: stats?.chess_rapid?.last?.rating,
    blitz: stats?.chess_blitz?.last?.rating,
    bullet: stats?.chess_bullet?.last?.rating,
    puzzle: stats?.tactics?.highest?.rating,
  }
}

function wmoCondition(code: number): string {
  if (code === 0) return 'Clear Sky'
  if (code <= 3) return 'Partly Cloudy'
  if (code <= 49) return 'Foggy'
  if (code <= 57) return 'Drizzle'
  if (code <= 67) return 'Rainy'
  if (code <= 77) return 'Snowy'
  if (code <= 82) return 'Showers'
  if (code <= 86) return 'Snow Showers'
  if (code <= 99) return 'Thunderstorm'
  return 'Unknown'
}

async function fetchWeather(location: string) {
  // Using free open-meteo (no key). Geocode -> forecast.
  const geo = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`)
  const place = geo?.results?.[0]
  if (!place) throw new Error('Location not found')
  const forecast = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&temperature_unit=celsius`)
  const code: number = forecast?.current?.weather_code ?? 0
  return {
    location: `${place.name}${place.country ? ', ' + place.country : ''}`,
    temperature: forecast?.current?.temperature_2m,
    weather_code: code,
    condition: wmoCondition(code),
    wind: forecast?.current?.wind_speed_10m,
    humidity: forecast?.current?.relative_humidity_2m,
  }
}

async function fetchDiscord(userId: string) {
  // halo.rip's in-house Lanyard replacement. The Discord bot writes
  // presenceUpdate snapshots to public.discord_presence; we read
  // straight from that table here. Users must be in halo.rip's main
  // Discord server (discord.gg/NgVh45gXbD) for the bot to see their
  // presence and create a row.
  //
  // Previous version HTTP-self-fetched /api/discord-presence/[id]
  // which broke under Node's strict URL parser when NEXT_PUBLIC_SITE_URL
  // isn't set in the server env (relative URL → "Failed to parse URL").
  // Direct DB query also saves a network hop.
  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from('discord_presence')
    .select('status, discord_user, activities, spotify')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`Presence lookup failed: ${error.message}`)
  if (!row) {
    throw new Error('Not in halo.rip Discord, join discord.gg/NgVh45gXbD')
  }

  const d = row.discord_user as {
    id?: string; username?: string; global_name?: string | null; avatar?: string | null; flags?: number
    clan?: { tag?: string | null; badge?: string | null; guild_id?: string | null } | null
  }
  // Detect Nitro heuristically from the avatar hash. Avatar hashes
  // that start with "a_" are animated, which is a Nitro-only feature.
  // Stable signal without needing to fetch premium_type per request.
  const hasAnimatedAvatar = typeof d?.avatar === 'string' && d.avatar.startsWith('a_')
  // Discord guild tag ("clan"). The bot persists { tag, badge, guild_id };
  // build the badge CDN URL here so the renderer just consumes { tag,
  // badge_url }. Badge is optional - some guild tags are text-only.
  const clan = d?.clan?.tag
    ? {
        tag: d.clan.tag,
        badge_url: d.clan.badge && d.clan.guild_id
          ? `https://cdn.discordapp.com/guild-tag-badges/${d.clan.guild_id}/${d.clan.badge}.png?size=48`
          : null,
      }
    : null
  return {
    id: d?.id ?? userId,
    username: d?.username,
    global_name: d?.global_name ?? null,
    avatar: d?.avatar
      ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png?size=256`
      : null,
    // Discord user flags bitfield (HypeSquad, Bug Hunter, Active
    // Developer, Early Supporter, Staff, Partner, etc.). The widget
    // renderer decodes bits and renders badge icons from
    // cdn.discordapp.com/badge-icons/. Default to 0 for old rows
    // written before the bot started persisting flags.
    flags: typeof d?.flags === 'number' ? d.flags : 0,
    // Nitro signal (heuristic - true when avatar is animated).
    has_nitro: hasAnimatedAvatar,
    // Discord guild tag / clan: { tag, badge_url } or null.
    clan,
    status: row.status,
    // Include ALL activities (type 4 = custom status, type 0 = Playing, etc.)
    activities: (Array.isArray(row.activities) ? row.activities : []).map((a: any) => ({
      name: a.name,
      details: a.details,
      state: a.state,
      type: a.type,
      emoji: a.emoji ?? null,
      assets: a.assets ?? null,
      application_id: a.application_id ?? null,
      timestamps: a.timestamps ?? null,
    })),
    spotify: row.spotify ? {
      song: (row.spotify as any).song,
      artist: (row.spotify as any).artist,
      album: (row.spotify as any).album,
      album_art_url: (row.spotify as any).album_art_url,
    } : null,
  }
}

async function fetchDiscordServer(inviteCode: string) {
  // Strip discord.gg/ and similar prefixes
  const stripped = inviteCode
    .replace(/^https?:\/\//, '')
    .replace(/^discord\.gg\//, '')
    .replace(/^discord\.com\/invite\//, '')
    .trim()

  // Post-strip whitelist. Discord invite codes are alphanumeric + the
  // occasional hyphen/underscore - never paths, colons, or dots. The
  // initial safeInviteCode regex has to be loose so the strippers
  // above can match "discord.gg/..." prefixes, but once those are
  // gone we tighten back down. Without this, a value like
  // "abc:5000/secret" would survive safeInviteCode and be interpolated
  // into the URL path. SSRF isn't reachable (host fixed to
  // discord.com) but it's still sloppy URL construction.
  if (!/^[a-zA-Z0-9_-]+$/.test(stripped)) {
    throw new Error('Invalid invite code')
  }
  const code = stripped

  const res = await fetch(
    `https://discord.com/api/v9/invites/${code}?with_counts=true`,
    { next: { revalidate: 60 } }
  )
  if (!res.ok) throw new Error('Invalid invite code or server not found')
  const data = await res.json()

  if (!data.guild) throw new Error('Server not found')

  return {
    name: data.guild.name,
    icon: data.guild.icon
      ? `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png?size=128`
      : null,
    description: data.guild.description || null,
    members: data.approximate_member_count ?? null,
    online: data.approximate_presence_count ?? null,
    inviteUrl: `https://discord.gg/${code}`,
    inviteCode: code,
  }
}

async function fetchTikTok(username: string) {
  const clean = username.replace(/^@/, '')
  // Use tikwm.com - free unofficial scraper API
  const res = await fetch(
    `https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(clean)}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.tikwm.com/',
      },
      // 20 min cache - shorter than TikTok CDN token expiry so avatar URLs stay fresh
      next: { revalidate: 1200 },
    }
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json?.code !== 0 || !json?.data) throw new Error('User not found')
  // tikwm API nests user data under data.user and stats under data.stats
  const raw = json.data
  const u = raw.user || raw
  const stats = raw.stats || raw
  // Avatar: serve the CDN URL directly - browser <img> tags can load TikTok CDN
  // without CORS issues. Server-side proxying breaks because datacenter IPs are
  // blocked by TikTok CDN, causing 403s. Signed URLs from tikwm are valid 3+ hours,
  // well beyond our 20-min cache window.
  const avatar = u.avatarLarger || u.avatarMedium || u.avatarThumb || u.avatar || null
  return {
    username: u.uniqueId || u.unique_id || clean,
    nickname: u.nickname || clean,
    avatar,
    bio: u.signature || '',
    verified: Boolean(u.verified),
    followers: stats.followerCount ?? u.followerCount ?? stats.fans_count ?? null,
    following: stats.followingCount ?? u.followingCount ?? null,
    likes: stats.heartCount ?? u.heartCount ?? null,
    videos: stats.videoCount ?? u.videoCount ?? null,
    url: `https://tiktok.com/@${u.uniqueId || u.unique_id || clean}`,
  }
}

// ─── Tracker.gg ─────────────────────────────────────────────────────
// Generic tracker.gg widget. Supports every game tracker.gg publishes
// rankings for - Rocket League, R6 Siege, Apex, Halo Infinite,
// Fortnite, Modern Warfare, etc. - by piggy-backing on their public-
// api endpoint which returns the same response shape across games.
//
// Auth: TRN_API_KEY env var. Required - no free tier works without it.
//
// Input: { game, platform, identifier } parsed by parseTrackerUrl
// from a single user-pasted profile URL like
//   https://tracker.gg/rocket-league/profile/steam/<id>/overview
//
// We hit /v2/<game>/standard/profile/<platform>/<identifier> and
// pull the top "overview" segment plus the first ranked playlist
// segment. Different games store rank under different stat names
// (RL = tier, R6 = rank, Halo = csr); the renderer just shows the
// segment's headline stat without trying to be game-aware.

const TRACKER_GAMES = new Set([
  'rocket-league', 'r6siege', 'apex', 'halo-infinite',
  'fortnite', 'modern-warfare', 'mw2', 'warzone-2',
  'destiny-2', 'splitgate', 'csgo', 'cs2', 'pubg',
  'valorant', 'overwatch', 'lol', 'tft', 'marvel-rivals',
  'xdefiant', 'the-finals', 'battlebit', 'battlefield-2042',
  'naraka-bladepoint', 'hunt-showdown', 'diablo-4',
])

const TRACKER_PLATFORMS = new Set([
  'steam', 'epic', 'origin', 'xbl', 'psn', 'uplay',
  'atvi', 'battlenet', 'riot',
])

interface ParsedTrackerUrl {
  game: string
  platform: string
  identifier: string
}

function parseTrackerUrl(url: string): ParsedTrackerUrl | null {
  if (typeof url !== 'string') return null
  // Strip the protocol + host. Also strip any query string + fragment
  // tracker.gg appends - LoL URLs include `?queue=RANKED_SOLO_5x5&season=...`
  // which would otherwise contaminate the last path segment.
  const cleaned = url
    .trim()
    .replace(/^https?:\/\/(www\.)?tracker\.gg\//, '')
    .replace(/[?#].*$/, '')
  const parts = cleaned.split('/').filter(Boolean)
  // Expected: [game, "profile", platform, identifier, ...rest]
  // (some games omit the "profile" segment)
  let game: string | undefined
  let platform: string | undefined
  let rawIdentifier: string | undefined
  if (parts.length >= 4 && parts[1] === 'profile') {
    game = parts[0]; platform = parts[2]; rawIdentifier = parts[3]
  } else if (parts.length >= 3) {
    game = parts[0]; platform = parts[1]; rawIdentifier = parts[2]
  }
  if (!game || !platform || !rawIdentifier) return null
  game = game.toLowerCase()
  platform = platform.toLowerCase()
  if (!TRACKER_GAMES.has(game) || !TRACKER_PLATFORMS.has(platform)) return null
  // Decode the identifier so Riot IDs like "EDG%20Viper%23NA11" round-trip
  // back to "EDG Viper#NA11". The fetch site will re-encode via
  // encodeURIComponent; without this we'd double-encode and the API
  // would 404.
  let identifier: string
  try {
    identifier = decodeURIComponent(rawIdentifier)
  } catch {
    identifier = rawIdentifier
  }
  // Identifier sanity check on the DECODED form. Allows alphanumeric,
  // dots, hyphens, underscores, hash + spaces (for Riot IDs), and
  // brackets used by some games. No slashes / colons / question marks
  // - those would shift segment in the URL.
  if (!/^[\w.\-# ()[\]]+$/.test(identifier)) return null
  return { game, platform, identifier: identifier.slice(0, 64) }
}

async function fetchTracker(profileUrl: string) {
  const apiKey = process.env.TRACKER_GG_API_KEY || process.env.TRN_API_KEY
  if (!apiKey) throw new Error('Tracker.gg API key not configured')
  const parsed = parseTrackerUrl(profileUrl)
  if (!parsed) throw new Error('Invalid tracker.gg URL')

  const apiUrl = `https://public-api.tracker.gg/v2/${parsed.game}/standard/profile/${parsed.platform}/${encodeURIComponent(parsed.identifier)}`
  const res = await fetch(apiUrl, {
    headers: {
      'TRN-Api-Key': apiKey,
      'Accept': 'application/json',
      // Some Cloudflare-fronted endpoints reject requests without a
      // realistic User-Agent. Without this, tracker.gg has been known
      // to return 401 / 403 even with a valid key.
      'User-Agent': 'halo.rip-widget/1.0 (+https://halo.rip)',
    },
    next: { revalidate: 60 },
  })
  if (res.status === 404) throw new Error('Player not found on tracker.gg')
  if (res.status === 429) throw new Error('Tracker.gg rate limit hit')
  if (res.status === 401) {
    // 401 with the right header pattern means the key itself was
    // rejected. Most common causes:
    //   1. Key copied wrong (truncated, trailing whitespace)
    //   2. Key from the wrong tracker.gg portal (e.g. a personal
    //      account key vs the Public API key from tracker.gg/developers)
    //   3. Key valid but not authorised for this game's data tier
    //      (Marvel Rivals, Diablo 4 etc. sometimes need higher tier)
    throw new Error('Tracker.gg API key invalid or unauthorized for this game')
  }
  if (res.status === 403) {
    throw new Error('Tracker.gg blocked the request (key tier may not cover this game)')
  }
  if (!res.ok) {
    let body = ''
    try { body = (await res.text()).slice(0, 200) } catch {}
    throw new Error(`Tracker.gg returned ${res.status}${body ? ': ' + body : ''}`)
  }
  const json = await res.json()
  const data = json?.data
  if (!data) throw new Error('Tracker.gg returned no data')

  const platformInfo = data.platformInfo || {}
  const segments: any[] = Array.isArray(data.segments) ? data.segments : []
  const overview = segments.find((s) => s.type === 'overview')
  // First non-overview segment with stats - usually the highest playlist
  // (e.g. "Ranked Doubles" for Rocket League, "Bot Royale" never wins
  // because we filter for stats presence).
  const playlist = segments.find(
    (s) => s.type !== 'overview' && s.stats && Object.keys(s.stats).length > 0,
  )

  // Extract a few top stats from overview. Tracker.gg returns each
  // stat as { value, displayValue, displayName }. We collect up to
  // 4 to render as pills in the widget body.
  const overviewStats = overview?.stats
    ? Object.entries(overview.stats).slice(0, 4).map(([key, s]: [string, any]) => ({
        key,
        name: s?.displayName || key,
        value: s?.displayValue ?? String(s?.value ?? '-'),
      }))
    : []

  return {
    game: parsed.game,
    platform: parsed.platform,
    handle: platformInfo.platformUserHandle || parsed.identifier,
    avatar: platformInfo.avatarUrl || null,
    profileUrl: `https://tracker.gg/${parsed.game}/profile/${parsed.platform}/${parsed.identifier}/overview`,
    overviewStats,
    playlistName: playlist?.metadata?.name || null,
    // Most-recognised "rank" stat from the playlist segment. Tracker.gg
    // names this differently per game (tier, rank, csr, mmr, etc.) so
    // we probe the common keys.
    playlistRank:
      playlist?.stats?.tier?.displayValue ||
      playlist?.stats?.rank?.displayValue ||
      playlist?.stats?.csr?.displayValue ||
      playlist?.stats?.mmr?.displayValue ||
      playlist?.stats?.rankScore?.displayValue ||
      null,
    playlistRankIcon:
      playlist?.stats?.tier?.metadata?.iconUrl ||
      playlist?.stats?.rank?.metadata?.iconUrl ||
      null,
  }
}

// ─── Spotify (oEmbed) ───────────────────────────────────────────────
// Renders any public Spotify track/album/playlist/artist/episode/show as a
// card (cover + title) from Spotify's keyless oEmbed endpoint. SSRF-safe:
// the URL host is validated to open.spotify.com before we forward it.
async function fetchSpotify(rawUrl: string) {
  let parsed: URL
  try { parsed = new URL(rawUrl) } catch { throw new Error('Invalid Spotify URL') }
  if (parsed.protocol !== 'https:' || !/(^|\.)spotify\.com$/.test(parsed.hostname)) {
    throw new Error('Not a Spotify URL')
  }
  const kind = parsed.pathname.split('/').filter(Boolean)[0] || 'track'
  const oembed = await fetchJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(parsed.toString())}`)
  return {
    title: oembed?.title || 'Spotify',
    thumbnail: oembed?.thumbnail_url || null,
    provider: oembed?.provider_name || 'Spotify',
    kind,
    url: parsed.toString(),
  }
}

// ─── Minecraft (playerdb.co, keyless) ───────────────────────────────
async function fetchMinecraft(username: string) {
  const data = await fetchJson(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(username)}`, {
    headers: { 'User-Agent': 'halo.rip-widget/1.0 (+https://halo.rip)' },
  })
  const p = data?.data?.player
  if (!p?.id) throw new Error('Player not found')
  return {
    username: p.username,
    uuid: p.id,
    avatar: p.avatar || `https://mc-heads.net/avatar/${p.id}/100`,
    body: `https://mc-heads.net/body/${p.id}/100`,
  }
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, { ...init, next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

// ─── Twitch (decapi.me, keyless) ────────────────────────────────────
async function fetchTwitch(username: string) {
  const [followers, avatar, game, title] = await Promise.all([
    fetchText(`https://decapi.me/twitch/followcount/${encodeURIComponent(username)}`).catch(() => ''),
    fetchText(`https://decapi.me/twitch/avatar/${encodeURIComponent(username)}`).catch(() => ''),
    fetchText(`https://decapi.me/twitch/game/${encodeURIComponent(username)}`).catch(() => ''),
    fetchText(`https://decapi.me/twitch/title/${encodeURIComponent(username)}`).catch(() => ''),
  ])
  const followersNum = parseInt(followers.replace(/[^\d]/g, ''), 10)
  if (avatar.startsWith('User') || isNaN(followersNum)) throw new Error('Channel not found')
  return {
    username,
    avatar: /^https?:\/\//.test(avatar) ? avatar : null,
    followers: isNaN(followersNum) ? null : followersNum,
    game: game && !/^.*not.*(playing|found)/i.test(game) ? game : null,
    title: title || null,
    url: `https://twitch.tv/${username}`,
  }
}

// ─── Overwatch (ow-api.com, keyless) ────────────────────────────────
async function fetchOverwatch(battletag: string) {
  const tag = battletag.replace('#', '-')
  const data = await fetchJson(`https://ow-api.com/v1/stats/pc/us/${encodeURIComponent(tag)}/profile`).catch(() => null)
  if (!data || data.error || !data.name) throw new Error('Player not found')
  const comp = data.ratings?.[0] || null
  return {
    name: data.name,
    icon: data.icon || null,
    endorsement: data.endorsement ?? null,
    endorsementIcon: data.endorsementIcon || null,
    prestige: data.prestige ?? data.level ?? null,
    rankName: comp?.group || comp?.role || null,
    rankTier: comp?.tier ?? null,
    rankIcon: comp?.rankIcon || null,
    url: `https://overwatch.blizzard.com/career/${encodeURIComponent(tag)}/`,
  }
}

// ─── Genshin Impact (enka.network, keyless) ─────────────────────────
async function fetchGenshin(uid: string) {
  const data = await fetchJson(`https://enka.network/api/uid/${encodeURIComponent(uid)}`, {
    headers: { 'User-Agent': 'halo.rip-widget/1.0 (+https://halo.rip)' },
  })
  const p = data?.playerInfo
  if (!p) throw new Error('Player not found')
  return {
    uid,
    nickname: p.nickname,
    level: p.level ?? null,
    signature: p.signature || null,
    worldLevel: p.worldLevel ?? null,
    achievements: p.finishAchievementNum ?? null,
    abyss: (p.towerFloorIndex && p.towerLevelIndex) ? `${p.towerFloorIndex}-${p.towerLevelIndex}` : null,
    url: `https://enka.network/u/${uid}/`,
  }
}

// ─── Stats.fm (keyless) ─────────────────────────────────────────────
async function fetchStatsfm(username: string) {
  const user = await fetchJson(`https://api.stats.fm/api/v1/users/${encodeURIComponent(username)}`)
  const u = user?.item
  if (!u) throw new Error('User not found')
  let nowPlaying: any = null
  let recent: any[] = []
  try {
    const rec = await fetchJson(`https://api.stats.fm/api/v1/users/${encodeURIComponent(username)}/streams/recent?limit=5`)
    recent = (rec?.items || []).map((s: any) => ({
      title: s.track?.name, artist: (s.track?.artists || []).map((a: any) => a.name).join(', '),
      image: s.track?.albums?.[0]?.image || null,
    }))
    nowPlaying = recent[0] || null
  } catch {}
  return {
    username: u.customId || username,
    displayName: u.displayName || username,
    avatar: u.image || null,
    nowPlaying,
    recent,
    url: `https://stats.fm/${u.customId || username}`,
  }
}

// ─── YouTube (RSS, keyless) ─────────────────────────────────────────
async function fetchYouTube(channelId: string) {
  // Accept a raw channel id (UC...) - the only keyless lookup.
  const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`)
  const channel = /<title>([^<]+)<\/title>/.exec(xml)?.[1] || 'YouTube'
  const firstEntry = xml.split('<entry>')[1] || ''
  const latestTitle = /<title>([^<]+)<\/title>/.exec(firstEntry)?.[1] || null
  const latestId = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(firstEntry)?.[1] || null
  return {
    channel,
    latestTitle,
    latestThumb: latestId ? `https://i.ytimg.com/vi/${latestId}/mqdefault.jpg` : null,
    latestUrl: latestId ? `https://youtube.com/watch?v=${latestId}` : null,
    url: `https://youtube.com/channel/${channelId}`,
  }
}

// ─── Pinterest (RSS, keyless - best effort) ─────────────────────────
async function fetchPinterest(username: string) {
  const clean = username.replace(/^@/, '')
  const xml = await fetchText(`https://www.pinterest.com/${encodeURIComponent(clean)}/feed.rss`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; halo.rip-widget/1.0)' },
  }).catch(() => '')
  const pins: { title: string; image: string | null; link: string | null }[] = []
  const items = xml.split('<item>').slice(1, 7)
  for (const it of items) {
    const title = /<title>(?:<!\[CDATA\[)?([^<\]]+)/.exec(it)?.[1]?.trim() || 'Pin'
    const image = /<img[^>]+src=["']([^"']+)/.exec(it)?.[1] || /<media:content[^>]+url=["']([^"']+)/.exec(it)?.[1] || null
    const link = /<link>([^<]+)<\/link>/.exec(it)?.[1] || null
    pins.push({ title, image, link })
  }
  return { username: clean, pins, url: `https://pinterest.com/${clean}/` }
}

// ─── Supercell games (Clash of Clans / Royale / Brawl Stars) ────────
// Require a Supercell developer token (env), since their API is IP-gated.
// Wired so they work the instant a token is configured; clear error until then.
async function fetchSupercell(game: 'coc' | 'cr' | 'bs', tag: string) {
  const cfg = {
    coc: { host: 'api.clashofclans.com', env: process.env.COC_API_TOKEN, label: 'Clash of Clans' },
    cr:  { host: 'api.clashroyale.com', env: process.env.CR_API_TOKEN, label: 'Clash Royale' },
    bs:  { host: 'api.brawlstars.com',  env: process.env.BS_API_TOKEN, label: 'Brawl Stars' },
  }[game]
  if (!cfg.env) throw new Error(`${cfg.label} API token not configured`)
  const cleanTag = tag.replace(/^#/, '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  const data = await fetchJson(`https://${cfg.host}/v1/players/%23${cleanTag}`, {
    headers: { Authorization: `Bearer ${cfg.env}` },
  })
  if (!data?.name) throw new Error('Player not found')
  return {
    game,
    name: data.name,
    tag: data.tag,
    level: data.expLevel ?? data.townHallLevel ?? data.kingLevel ?? null,
    trophies: data.trophies ?? null,
    bestTrophies: data.bestTrophies ?? data.highestTrophies ?? null,
    clan: data.clan?.name || null,
  }
}

// Input sanitisers - prevent path manipulation in external API URLs
function safeUsername(val: unknown, maxLen = 64): string {
  if (typeof val !== 'string') return ''
  // Only allow alphanumeric, dots, hyphens, underscores - no slashes or special chars
  return val.replace(/[^a-zA-Z0-9._\-]/g, '').slice(0, maxLen)
}

function safeNumericId(val: unknown): string {
  if (typeof val !== 'string' && typeof val !== 'number') return ''
  return String(val).replace(/\D/g, '').slice(0, 20)
}

function safeInviteCode(val: unknown): string {
  if (typeof val !== 'string') return ''
  // Invite codes are alphanumeric only
  return val.replace(/[^a-zA-Z0-9\-_./: ]/g, '').slice(0, 128)
}

function safeLocation(val: unknown): string {
  if (typeof val !== 'string') return ''
  return val.replace(/[<>'"]/g, '').slice(0, 128)
}

const VALID_TYPES = new Set([
  'github', 'lastfm', 'roblox', 'valorant', 'chess',
  'weather', 'discord', 'tiktok', 'discord-server',
  'tracker', 'spotify', 'minecraft', 'time', 'custom',
  'twitch', 'overwatch', 'genshin', 'statsfm', 'youtube',
  'pinterest', 'clashofclans', 'clashroyale', 'brawlstars',
  'twitter', 'telegram',
])

// Static widgets render purely from their saved config (no upstream API).
// We echo a sanitised copy back so the existing batch-fetch + render flow
// treats them like any other widget.
function safeText(val: unknown, maxLen = 200): string {
  if (typeof val !== 'string') return ''
  return val.replace(/[<>]/g, '').slice(0, maxLen)
}
function safeHttpUrl(val: unknown): string {
  if (typeof val !== 'string') return ''
  try {
    const u = new URL(val)
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.toString().slice(0, 400) : ''
  } catch { return '' }
}

// Dispatch one widget config through the type-specific fetcher above.
async function fetchOne(type: string, config: any): Promise<any> {
  switch (type) {
    case 'github':         return fetchGitHub(safeUsername(config?.username))
    case 'lastfm':         return fetchLastFm(safeUsername(config?.username))
    case 'roblox':         return fetchRoblox(safeNumericId(config?.userId))
    case 'valorant':       return fetchValorant(safeUsername(config?.username), safeUsername(config?.tag, 16))
    case 'chess':          return fetchChess(safeUsername(config?.username))
    case 'weather':        return fetchWeather(safeLocation(config?.location))
    case 'discord':        return fetchDiscord(safeNumericId(config?.userId))
    case 'tiktok':         return fetchTikTok(safeUsername(config?.username))
    case 'discord-server': return fetchDiscordServer(safeInviteCode(config?.inviteCode))
    // Tracker.gg widget takes a single URL field; parseTrackerUrl
    // does its own validation so we don't need a sanitiser here.
    case 'tracker':        return fetchTracker(String(config?.url ?? ''))
    case 'spotify':        return fetchSpotify(String(config?.url ?? ''))
    case 'minecraft':      return fetchMinecraft(safeUsername(config?.username, 16))
    case 'twitch':         return fetchTwitch(safeUsername(config?.username, 30))
    case 'overwatch':      return fetchOverwatch(String(config?.battletag ?? '').replace(/[^a-zA-Z0-9#\-]/g, '').slice(0, 32))
    case 'genshin':        return fetchGenshin(safeNumericId(config?.uid))
    case 'statsfm':        return fetchStatsfm(safeUsername(config?.username, 40))
    case 'youtube':        return fetchYouTube(safeUsername(config?.channelId, 40))
    case 'pinterest':      return fetchPinterest(safeUsername(config?.username, 40))
    case 'clashofclans':   return fetchSupercell('coc', safeUsername(config?.tag, 16))
    case 'clashroyale':    return fetchSupercell('cr', safeUsername(config?.tag, 16))
    case 'brawlstars':     return fetchSupercell('bs', safeUsername(config?.tag, 16))
    // Twitter/Telegram have no keyless public profile API - render a clean
    // profile card (handle + link) from the saved config, no fake stats.
    case 'twitter':        return { username: safeUsername(config?.username, 30), url: `https://x.com/${safeUsername(config?.username, 30)}` }
    case 'telegram':       return { username: safeUsername(config?.username, 40), url: `https://t.me/${safeUsername(config?.username, 40)}` }
    // Static widgets: echo back a sanitised config (rendered client-side).
    case 'time':           return { timezone: safeText(config?.timezone, 64) || 'UTC', label: safeText(config?.label, 40) }
    case 'custom':         return {
      title: safeText(config?.title, 60),
      subtitle: safeText(config?.subtitle, 120),
      imageUrl: safeHttpUrl(config?.imageUrl),
      link: safeHttpUrl(config?.link),
    }
    default:               throw new Error('Unknown widget type')
  }
}

export async function POST(request: Request) {
  try {
    // Dedicated bucket - each call fans out to up to 8+ upstream
    // APIs (Last.fm / GitHub / TikWM / Tracker.gg / Discord /
    // Roblox / Spotify / Weather), so sharing the general 300/min
    // bucket meant one IP could drive ~2,400 upstream req/min
    // through us and burn through every third-party key's free
    // quota long before our own bucket noticed. 30/min is plenty
    // for a single tab polling every 10s; anything past that
    // smells like scraping.
    const rateLimit = await withRateLimit(request, 'widgetsFetch')
    if (rateLimit.response) return rateLimit.response

    const body = await request.json()

    // ─── Batch mode: { widgets: [{ id, type, config }, ...] } ────────────
    // The profile page sends all enabled widgets at once. Each one is
    // resolved independently (Promise.allSettled) so one failure doesn't
    // poison the rest.
    if (Array.isArray(body?.widgets)) {
      const widgets = body.widgets.slice(0, 12) // cap to prevent abuse
      const results = await Promise.all(widgets.map(async (w: any) => {
        if (!w?.type || !VALID_TYPES.has(w.type)) {
          return { id: w?.id ?? null, error: 'Unknown widget type' }
        }
        try {
          const data = await fetchOne(w.type, w.config)
          return { id: w.id ?? null, data }
        } catch (error: any) {
          return { id: w.id ?? null, error: error?.message || 'Failed to fetch widget data' }
        }
      }))
      return NextResponse.json({ results })
    }

    // ─── Single mode (back-compat for older clients) ────────────────────
    const { type, config } = body
    if (!type || !VALID_TYPES.has(type)) {
      return NextResponse.json({ error: 'Unknown widget type' }, { status: 400 })
    }
    const data = await fetchOne(type, config)
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch widget data' }, { status: 400 })
  }
}
