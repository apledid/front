import { NextResponse } from "next/server"
import { getApiUser, getApiUserId } from "@/lib/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { withRateLimit } from '@/lib/rate-limit'
import { isAllowedMediaUrl } from '@/lib/url-validation'
import { sanitizeMarkupSource } from '@/lib/security'

// Audio Manager limits - premium users get 5 rotating tracks, free get 3.
// Single source of truth so GET/POST/UI stay in sync.
const FREE_TRACK_LIMIT = 3
const PREMIUM_TRACK_LIMIT = 5
const trackLimitFor = (profile: { premium_active?: boolean | null } | null) =>
  profile?.premium_active ? PREMIUM_TRACK_LIMIT : FREE_TRACK_LIMIT

// The track's external "source" link (e.g. its Apple Music / Spotify page).
// This renders as a normal <a href>, NOT a media element, so it uses a plain
// http(s) check rather than the media allowlist that gates track_url/cover_url.
function safeExternalUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s) return null
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return s.slice(0, 500)
  } catch {
    return null
  }
}

// LRC lyrics are rendered as escaped React text on the profile (no markup), so
// the only real concern is size. Newlines are kept - the format is line-based.
function cleanLyrics(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.slice(0, 20000)
  return s.trim() ? s : null
}

export async function GET() {
  try {
    const profile = await getApiUser()

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const limit = trackLimitFor(profile as never)
    const supabase = createAdminClient()
    const { data: tracks, error } = await supabase
      .from("music_history")
      .select("*")
      .eq("user_id", profile.id)
      .order("added_at", { ascending: true })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Detect track type from URL if not stored
    const detectTrackType = (url: string): string => {
      if (url.includes('spotify.com')) return 'spotify'
      if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
      if (url.includes('soundcloud.com')) return 'soundcloud'
      return 'direct'
    }

    const formattedTracks = (tracks || []).map((track: any) => ({
      id: track.id,
      title: track.track_title || "",
      artist: track.track_artist || "",
      url: track.track_url || "",
      type: track.track_type || detectTrackType(track.track_url || ""),
      cover_url: track.cover_url || null,
      display_as_record: track.display_as_record || false,
      spin_record: track.spin_record || false,
      lyrics: track.lyrics || null,
      external_url: track.external_url || null,
    }))

    return NextResponse.json({ tracks: formattedTracks })
  } catch {
    return NextResponse.json({ error: "Failed to fetch tracks" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = profile.id
    const limit = trackLimitFor(profile as never)

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    
    const { track_title, track_artist, track_url, track_type, cover_url, display_as_record, spin_record, lyrics, external_url } = body

    if (!track_url || typeof track_url !== 'string') {
      return NextResponse.json({ error: "Track URL is required" }, { status: 400 })
    }

    // Use the shared isAllowedMediaUrl helper which does proper
    // hostname-suffix matching. The old inline check used
    // `track_url.includes(domain)` which is substring-matching, so
    // URLs like https://attacker.com/halo.rip/evil.mp3 or
    // https://halo.rip.attacker.com/x.mp3 both passed the check.
    // The shared helper rejects both via new URL(...).hostname checks.
    if (!isAllowedMediaUrl(track_url)) {
      return NextResponse.json({
        error: "External URLs are not allowed. Please upload your audio file directly using the upload button.",
      }, { status: 400 })
    }

    // cover_url goes through the same allowlist as every other media
    // URL on the site. Without this, it was the one user-controllable
    // URL field that could point anywhere - a tracking pixel, an
    // attacker-controlled host scraping viewer IPs via Referer, or a
    // very large external image used to DoS-by-bandwidth. Rendered
    // as <img src> so not XSS-able, but the consistency closes the
    // gap that every other field already closes.
    if (cover_url && !isAllowedMediaUrl(cover_url)) {
      return NextResponse.json({
        error: "Cover image URL must be uploaded through the cover picker.",
      }, { status: 400 })
    }

    const supabase = createAdminClient()
    
    // Count, then insert; a post-insert recheck below undoes the row if a
    // concurrent request raced past the cap (count + insert is not atomic).
    const { count, error: countError } = await supabase
      .from("music_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 })
    }

    if ((count || 0) >= limit) {
      return NextResponse.json(
        { error: `You can only keep up to ${limit} rotating songs.` },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("music_history")
      .insert({
        user_id: userId,
        // Sanitize per the same policy used elsewhere on the site.
        // Rendered as React text nodes so JSX auto-escaping already
        // covers the XSS path - this just keeps the data shape
        // consistent with the rest of the codebase (no zero-width
        // chars, no control characters, length cap).
        track_title: sanitizeMarkupSource(String(track_title || "Untitled")).slice(0, 200),
        track_artist: sanitizeMarkupSource(String(track_artist || "Unknown")).slice(0, 200),
        track_url,
        track_type: track_type || "direct",
        added_at: new Date().toISOString(),
        cover_url: cover_url || null,
        display_as_record: display_as_record || false,
        spin_record: spin_record || false,
        lyrics: cleanLyrics(lyrics),
        external_url: safeExternalUrl(external_url),
      })
      .select("id, track_title, track_artist, track_url, track_type, cover_url, display_as_record, spin_record, lyrics, external_url")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Close the count-then-insert race: if a concurrent insert pushed us past
    // the cap, undo this one so the rotating-songs limit holds.
    const { count: after } = await supabase
      .from("music_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
    if ((after || 0) > limit && data) {
      await supabase.from("music_history").delete().eq("id", (data as { id: string }).id)
      return NextResponse.json({ error: `You can only keep up to ${limit} rotating songs.` }, { status: 400 })
    }

    // Update profile music fields for the first track (non-blocking)
    if ((count || 0) === 0) {
      supabase
        .from("profiles")
        .update({
          music_url: track_url,
          music_title: track_title || "Untitled",
          music_artist: track_artist || "Unknown",
          music_type: track_type || "direct",
          music_enabled: true,
        })
        .eq("id", userId)
        .then(() => {})
        .catch(() => {})
    }

    return NextResponse.json({
      track: {
        id: data.id,
        title: data.track_title || "",
        artist: data.track_artist || "",
        url: data.track_url || "",
        type: data.track_type || "direct",
        cover_url: data.cover_url || null,
        display_as_record: data.display_as_record || false,
        spin_record: data.spin_record || false,
        lyrics: data.lyrics || null,
        external_url: data.external_url || null,
      },
    })
  } catch {
    return NextResponse.json({ error: "Failed to add track" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const userId = await getApiUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { id, display_as_record, spin_record, track_title, track_artist, lyrics, external_url } = body

    if (!id) {
      return NextResponse.json({ error: "Track ID is required" }, { status: 400 })
    }

    // Build a partial update so callers can send any subset of fields
    // (renaming a track sends title/artist, toggle buttons send the boolean
    // flags). Previously this route ignored title/artist entirely, which is
    // why renaming silently failed.
    const updates: Record<string, unknown> = {}
    if (display_as_record !== undefined) updates.display_as_record = !!display_as_record
    if (spin_record !== undefined) updates.spin_record = !!spin_record
    if (track_title !== undefined) updates.track_title = sanitizeMarkupSource(String(track_title)).slice(0, 200)
    if (track_artist !== undefined) updates.track_artist = sanitizeMarkupSource(String(track_artist)).slice(0, 200)
    if (lyrics !== undefined) updates.lyrics = cleanLyrics(lyrics)
    if (external_url !== undefined) updates.external_url = safeExternalUrl(external_url)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("music_history")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id, track_title, track_artist, display_as_record, spin_record, lyrics, external_url")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ track: data })
  } catch {
    return NextResponse.json({ error: "Failed to update track" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const userId = await getApiUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    
    const { id } = body
    
    if (!id) {
      return NextResponse.json({ error: "Track ID is required" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("music_history")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Check remaining tracks and update profile accordingly
    const { data: remainingTracks } = await supabase
      .from("music_history")
      .select("track_url, track_title, track_artist, track_type")
      .eq("user_id", userId)
      .order("added_at", { ascending: true })
      .limit(1)

    if (remainingTracks && remainingTracks.length > 0) {
      // Set profile to first remaining track
      await supabase
        .from("profiles")
        .update({
          music_url: remainingTracks[0].track_url,
          music_title: remainingTracks[0].track_title,
          music_artist: remainingTracks[0].track_artist,
          music_type: remainingTracks[0].track_type || "direct",
        })
        .eq("id", userId)
    } else {
      // No tracks left, clear profile music fields
      await supabase
        .from("profiles")
        .update({
          music_url: null,
          music_title: null,
          music_artist: null,
          music_type: null,
        })
        .eq("id", userId)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete track" }, { status: 500 })
  }
}
