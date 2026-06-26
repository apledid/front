import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getApiUser } from '@/lib/api-auth'
import { GunsProfile } from '@/components/profile/guns-profile'
import { TemplatePreviewClient } from './client'
import type { TemplateRow } from '@/components/templates/template-card'

export const dynamic = 'force-dynamic'

interface PreviewProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ bare?: string }>
}

// Marketplace listing page for a single template. The actual profile
// preview is rendered by <GunsProfile> exactly as it would appear on a
// real profile - videos, music, widgets, effects all run live. The
// client overlay adds the marketplace chrome (top bar, drawer, related).
//
// `?bare=1` skips the chrome - used by the dashboard's preview iframe
// modal so the chrome isn't rendered twice inside the iframe.
export default async function TemplatePreviewPage({ params, searchParams }: PreviewProps) {
  const { id } = await params
  const { bare } = await searchParams
  const isBare = bare === '1'
  const admin = createAdminClient()

  const { data: tpl } = await admin
    .from('templates')
    .select('*, author:profiles!templates_user_id_fkey(id, username, avatar_url, display_name)')
    .eq('id', id)
    .single()

  if (!tpl) notFound()
  if (tpl.visibility !== 'public') notFound()

  const config = (tpl.config || {}) as Record<string, any>

  // Build a synthetic profile from the author as a base, overlaying the
  // template config on top. Strip snapshot-only keys (__social_links etc).
  const author = (tpl.author as any) || {}
  const baseProfile: Record<string, any> = {
    id: `preview-${tpl.id}`,
    username: author.username || 'preview',
    display_name: author.display_name || author.username || 'Preview',
    avatar_url: author.avatar_url || null,
    bio: tpl.description || null,
    view_count: 0,
    is_public: true,
  }
  for (const [k, v] of Object.entries(config)) {
    if (k.startsWith('__')) continue
    baseProfile[k] = v
  }

  // Force-skip the enter splash in template previews. The whole point of
  // the preview is to showcase the template's visual design - blocking
  // it behind a "Click anywhere to enter" gate (with a broken/missing
  // avatar of the original author, no less) just makes the preview look
  // dead. People who actually want the splash will see it once they
  // apply the template to their own profile.
  baseProfile.enter_enabled = false

  const snapSocial = Array.isArray(config.__social_links) ? config.__social_links : []
  const snapButtons = Array.isArray(config.__custom_buttons) ? config.__custom_buttons : []
  const snapMusic = Array.isArray(config.__music_tracks) ? config.__music_tracks : []

  const socialLinks = snapSocial.map((r: any, i: number) => ({
    id: `prev-social-${i}`,
    user_id: baseProfile.id,
    platform: r.platform || 'website',
    url: r.url || '',
    label: r.label || null,
    icon_url: r.icon_url || null,
    display_order: r.display_order ?? i,
    created_at: new Date().toISOString(),
  }))

  const customButtons = snapButtons.map((r: any, i: number) => ({
    id: `prev-btn-${i}`,
    user_id: baseProfile.id,
    label: r.label || 'Link',
    url: r.url || '',
    media_url: r.media_url || null,
    media_type: r.media_type || null,
    bg_color: r.bg_color || null,
    text_color: r.text_color || null,
    disable_background: !!r.disable_background,
    display_order: r.display_order ?? i,
    created_at: new Date().toISOString(),
  }))

  // Preserve the full music array (was previously capped at 3 - the public
  // profile fix already adjusted this elsewhere, mirror the change here).
  const musicTracks = snapMusic.map((r: any, i: number) => ({
    id: `prev-music-${i}`,
    title: r.track_title || '',
    artist: r.track_artist || '',
    url: r.track_url || '',
    type: r.track_type || 'direct',
  }))

  // Server-side concurrency: fetch related templates, author's other
  // public templates count, and the viewer's auth state in parallel.
  const tags: string[] = Array.isArray(tpl.tags) ? tpl.tags : []
  const [relatedRes, authorCountRes, viewer] = await Promise.all([
    tags.length > 0
      ? admin
          .from('templates')
          .select('id, name, description, preview_image, tags, visibility, config, uses_count, likes_count, premium_features, user_id, created_at, author:profiles!templates_user_id_fkey(username, avatar_url)')
          .eq('visibility', 'public')
          .neq('id', tpl.id)
          .overlaps('tags', tags)
          .order('likes_count', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] as any[] }),
    author.id
      ? admin
          .from('templates')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', author.id)
          .eq('visibility', 'public')
      : Promise.resolve({ count: 0 }),
    getApiUser().catch(() => null),
  ])

  const relatedTemplates = (relatedRes.data || []) as TemplateRow[]
  const authorOtherCount = Math.max(0, (authorCountRes.count || 0) - 1)

  return (
    <TemplatePreviewClient
      template={tpl as unknown as TemplateRow}
      relatedTemplates={relatedTemplates}
      authorOtherCount={authorOtherCount}
      bare={isBare}
      viewer={
        viewer
          ? {
              id: viewer.id,
              username: viewer.username,
              premium_active: !!(viewer as any).premium_active,
              is_admin: !!(viewer as any).is_admin || viewer.username === 'rez',
            }
          : { id: null, username: null, premium_active: false, is_admin: false }
      }
    >
      <GunsProfile
        profile={baseProfile as any}
        socialLinks={socialLinks as any}
        badges={[]}
        badgeLoadout={[]}
        titleLoadout={[]}
        customButtons={customButtons as any}
        musicTracks={musicTracks as any}
      />
    </TemplatePreviewClient>
  )
}
