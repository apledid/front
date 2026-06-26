import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectPremiumFeatures } from '@/lib/premium-features'
import { withRateLimit } from '@/lib/rate-limit'
import { PROFILE_ALLOWED_COLUMNS } from '@/lib/profile-columns'

// Source of truth for template style fields: PROFILE_ALLOWED_COLUMNS,
// minus identity / content columns that don't belong in a "look" snapshot.
// Previously this was a hand-curated ~50-field array that drifted out
// of sync with the live profile schema - templates saved before a new
// column was added would never capture or restore that column. Using
// the allowlist directly keeps the snapshot complete and forward-
// compatible.
//
// Identity / per-user content fields that are intentionally excluded
// from templates (username, email, real bio text, avatar URL, banner
// URL, location, etc.) are NOT in PROFILE_ALLOWED_COLUMNS in the
// first place, so they're filtered out automatically.
const TEMPLATE_EXCLUDED = new Set<string>([
  // Identity-ish fields the user shouldn't accidentally clone from someone else
  'display_name',
  'bio',
  'location',
  // Avatar/banner imagery is per-user content, not style
  'avatar_url',
  'banner_url',
  'avatar_decoration_hash',
  'use_discord_avatar',
  'discord_avatar',
  'discord_avatar_decoration',
  // Live music state belongs to the user, not the template
  'music_url',
  'music_title',
  'music_artist',
  'music_volume',
  'music_show_cover',
  // SEO / metadata - per-user identity, premium-gated, not style. Snapshotting
  // these into a public template would let any user clone the favicon /
  // embed metadata of another (and would always be stripped on apply for
  // non-premium users anyway).
  'favicon_url',
  'embed_title',
  'embed_description',
  'embed_image_url',
  'embed_color',
])

const TEMPLATE_FIELDS: readonly string[] = PROFILE_ALLOWED_COLUMNS.filter(
  (col) => !TEMPLATE_EXCLUDED.has(col),
)

// Allowed sort modes for the public library. The new UI surfaces all four;
// `trending` falls back to `most_liked` order at the SQL level until we add
// a SQL expression / generated column for likes_count * 2 + uses_count.
// That's intentional: the API contract is stable, the v1 ranking is just
// "best-effort" trending. Future work: a `templates.trending_score` column
// updated by a trigger, or a view.
type TemplateSort = 'trending' | 'most_liked' | 'newest' | 'most_used'

function sortColumn(sort: TemplateSort): { column: string; ascending: boolean } {
  switch (sort) {
    case 'newest':
      return { column: 'created_at', ascending: false }
    case 'most_used':
      return { column: 'uses_count', ascending: false }
    case 'most_liked':
    case 'trending':
    default:
      return { column: 'likes_count', ascending: false }
  }
}

const PAGE_SIZE_DEFAULT = 24
const PAGE_SIZE_MAX = 60

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope') || 'public' // public | mine | favorites
    const search = url.searchParams.get('q') || ''
    const sortRaw = (url.searchParams.get('sort') || 'trending') as TemplateSort
    const sort: TemplateSort = (['trending', 'most_liked', 'newest', 'most_used'] as TemplateSort[]).includes(sortRaw)
      ? sortRaw
      : 'trending'
    const tagRaw = url.searchParams.get('tag') || ''
    const tagsFilter = tagRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const premiumFilter = (url.searchParams.get('premium') || 'all') as 'all' | 'free' | 'pro'
    const pageRaw = parseInt(url.searchParams.get('page') || '1', 10)
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1
    const pageSizeRaw = parseInt(url.searchParams.get('pageSize') || String(PAGE_SIZE_DEFAULT), 10)
    const pageSize = Math.min(
      PAGE_SIZE_MAX,
      Math.max(1, Number.isFinite(pageSizeRaw) ? pageSizeRaw : PAGE_SIZE_DEFAULT),
    )
    const start = (page - 1) * pageSize
    const end = start + pageSize - 1
    const admin = createAdminClient()

    if (scope === 'mine' || scope === 'favorites') {
      const profile = await getApiUser()
      if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      if (scope === 'mine') {
        const { data, error, count } = await admin
          .from('templates')
          .select('*, author:profiles!templates_user_id_fkey(username, avatar_url)', { count: 'exact' })
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json({ templates: data || [], total: count ?? (data?.length || 0), page: 1, pageSize: (data?.length || 0) })
      }

      const { data, error } = await admin
        .from('template_favorites')
        .select('template_id, templates(*, author:profiles!templates_user_id_fkey(username, avatar_url))')
        .eq('user_id', profile.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      const templates = (data || []).map((r: any) => r.templates).filter(Boolean)
      return NextResponse.json({ templates, total: templates.length, page: 1, pageSize: templates.length })
    }

    // Public library - paginated, sortable, filterable
    const { column, ascending } = sortColumn(sort)
    let query = admin
      .from('templates')
      .select('*, author:profiles!templates_user_id_fkey(username, avatar_url)', { count: 'exact' })
      .eq('visibility', 'public')
      .order(column, { ascending })
      .range(start, end)
    if (search) query = query.ilike('name', `%${search}%`)
    if (tagsFilter.length > 0) query = query.overlaps('tags', tagsFilter)
    if (premiumFilter === 'free') query = query.eq('premium_features', '{}')
    else if (premiumFilter === 'pro') query = query.not('premium_features', 'eq', '{}')

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({
      templates: data || [],
      total: count ?? (data?.length || 0),
      page,
      pageSize,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { name, description, preview_image, tags, visibility, source_template_id } = body || {}
    if (!name || !name.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const admin = createAdminClient()

    // Template cap: 3 for free, 10 for premium / staff. Hardcoded into
    // the spec; bump these if/when we want a real tier table. The UI
    // pulls the same cap from /api/profile to preflight the create
    // button so the user sees their slot count before hitting POST.
    const isAdmin = !!(profile as any).is_admin || profile.username === 'rez'
    const TEMPLATE_CAP = profile.premium_active || isAdmin ? 10 : 3
    const { count } = await admin
      .from('templates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
    if ((count || 0) >= TEMPLATE_CAP) {
      return NextResponse.json({
        error: profile.premium_active || isAdmin
          ? `You can only save up to ${TEMPLATE_CAP} templates.`
          : `Free accounts can save up to ${TEMPLATE_CAP} templates. Upgrade for ${10} slots.`,
        cap: TEMPLATE_CAP,
      }, { status: 400 })
    }

    let config: Record<string, any> = {}

    if (source_template_id) {
      // Duplicate flow: clone an existing template's config instead of
      // snapshotting the user's current profile. Visible templates plus
      // the requester's own private templates are clonable.
      const { data: src, error: srcErr } = await admin
        .from('templates')
        .select('id, user_id, config, visibility')
        .eq('id', source_template_id)
        .single()
      if (srcErr || !src) return NextResponse.json({ error: 'Source template not found' }, { status: 404 })
      if (src.visibility !== 'public' && src.user_id !== profile.id) {
        return NextResponse.json({ error: 'Source template is private' }, { status: 403 })
      }
      config = { ...(src.config || {}) }
    } else {
      // Snapshot the user's current profile styling into the template config.
      // Guard with explicit error checks - the previous version silently
      // produced an empty template if the profile fetch failed, which
      // ate one of the user's slot caps without giving any useful style.
      const { data: full, error: profileErr } = await admin
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .single()
      if (profileErr || !full) {
        console.error('[templates POST] profile snapshot failed:', profileErr)
        return NextResponse.json(
          { error: 'Could not snapshot your profile. Try again.' },
          { status: 500 },
        )
      }
      for (const field of TEMPLATE_FIELDS) {
        if (field in full) config[field] = (full as any)[field]
      }

      // Also snapshot related tables (only non-empty rows)
      const [socialLinksRes, buttonsRes, musicRes, widgetsRes] = await Promise.all([
        admin.from('social_links').select('platform,url,label,icon_url,display_order').eq('user_id', profile.id).order('display_order'),
        admin.from('custom_buttons').select('label,url,media_url,media_type,bg_color,text_color,disable_background,display_order').eq('user_id', profile.id).order('display_order'),
        admin.from('music_history').select('track_title,track_artist,track_url,track_type,added_at').eq('user_id', profile.id).order('added_at', { ascending: false }).limit(10),
        admin.from('widgets').select('type,config,display_order,enabled').eq('user_id', profile.id).order('display_order'),
      ])

      config.__social_links = (socialLinksRes.data || []).filter((r: any) => r.url && String(r.url).trim())
      config.__custom_buttons = (buttonsRes.data || []).filter((r: any) => r.url && String(r.url).trim())
      config.__music_tracks = (musicRes.data || []).filter((r: any) => r.track_url)
      config.__widgets = (widgetsRes.data || []).filter((r: any) => r.enabled !== false && r.config && Object.values(r.config).some((v: any) => v != null && String(v).trim() !== ''))
    }

    const premiumFeatures = detectPremiumFeatures(config)

    const { data, error } = await admin
      .from('templates')
      .insert({
        user_id: profile.id,
        name: String(name).trim().slice(0, 80),
        description: description ? String(description).slice(0, 500) : null,
        preview_image: preview_image || null,
        tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
        visibility: visibility === 'private' ? 'private' : 'public',
        config,
        premium_features: premiumFeatures,
      })
      .select('*, author:profiles!templates_user_id_fkey(username, avatar_url)')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ template: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, ...updates } = await request.json()
    const admin = createAdminClient()

    // Only allow safe fields
    const allowed: any = {}
    for (const k of ['name', 'description', 'preview_image', 'tags', 'visibility']) {
      if (k in updates) allowed[k] = updates[k]
    }

    const { data, error } = await admin
      .from('templates')
      .update(allowed)
      .eq('id', id)
      .eq('user_id', profile.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ template: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await request.json()
    const admin = createAdminClient()

    // Admins can delete any template; everyone else only their own
    let q = admin.from('templates').delete().eq('id', id)
    if (!profile.is_admin && profile.username !== 'rez') {
      q = q.eq('user_id', profile.id)
    }
    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })
  }
}
