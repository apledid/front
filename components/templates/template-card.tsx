'use client'

import {
  IconCrown,
  IconDownload,
  IconEye,
  IconFlag,
  IconHeart,
  IconLoader2,
  IconDotsVertical,
  IconPencil,
  IconShare3,
  IconStar,
  IconTrash,
} from '@tabler/icons-react'
import { TemplateThumbnail } from './template-thumbnail'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type TemplateRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  preview_image: string | null
  tags: string[] | null
  visibility: string
  config: any
  uses_count: number
  likes_count: number
  premium_features?: string[] | null
  created_at: string
  author?: { username: string; avatar_url: string | null } | null
}

export type TemplateCardViewer = {
  id?: string | null
  username?: string | null
  premium_active?: boolean | null
  is_admin?: boolean | null
}

export type TemplateCardScope = 'library' | 'favorites' | 'mine'

export interface TemplateCardProps {
  template: TemplateRow
  viewer: TemplateCardViewer
  scope: TemplateCardScope
  busy?: boolean
  liked?: boolean
  favorited?: boolean
  onPreview?: (t: TemplateRow) => void
  onLike?: (t: TemplateRow) => void
  onFavorite?: (t: TemplateRow) => void
  onApply?: (t: TemplateRow) => void
  onEdit?: (t: TemplateRow) => void
  onDuplicate?: (t: TemplateRow) => void
  onDelete?: (t: TemplateRow) => void
  onReport?: (t: TemplateRow) => void
  onTagClick?: (tag: string) => void
  onVisibilityToggle?: (t: TemplateRow) => void
  onCopyLink?: (t: TemplateRow) => void
}

/**
 * Reusable marketplace card for a single template.
 *
 * Layout:
 *   ┌─────────────────────────────────────────┐
 *   │ [visibility]                  [PRO][⭐] │
 *   │            thumbnail / placeholder       │
 *   │                                         │
 *   ├─────────────────────────────────────────┤
 *   │ Name                                    │
 *   │ Description (2 lines)                   │
 *   │ #tag #tag #tag                          │
 *   │ author · ⬇ uses               ♥ likes   │
 *   │ [Preview ────────────────────────] [⋯] │
 *   └─────────────────────────────────────────┘
 *
 * The PRO badge appears top-right when the template requires premium
 * features AND the viewer is not premium - so free users see the gate
 * before they click Apply and hit a 402.
 */
export function TemplateCard({
  template: t,
  viewer,
  scope,
  busy = false,
  liked = false,
  favorited = false,
  onPreview,
  onLike,
  onFavorite,
  onApply,
  onEdit,
  onDuplicate,
  onDelete,
  onReport,
  onTagClick,
  onVisibilityToggle,
  onCopyLink,
}: TemplateCardProps) {
  const isOwn = scope === 'mine' || (viewer.id && viewer.id === t.user_id)
  const isAdmin = !!viewer.is_admin
  const needsPremium = (t.premium_features?.length ?? 0) > 0
  // Bypass the premium gate for admins / staff. Without this check,
  // staff accounts (like @rez) saw PRO badges and the "Premium" lock
  // on the apply button even though apply works for them.
  const showProBadge = needsPremium && viewer.premium_active !== true && !isAdmin
  const accentColor = (t.config?.accent_color as string | undefined) || null
  const backgroundColor = (t.config?.background_color as string | undefined) || null
  const cardStyle = (t.config?.card_style as string | undefined) || null
  const tags = Array.isArray(t.tags) ? t.tags : []

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:-translate-y-1 hover:border-primary/30"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.5)' }}
    >
      {/* Thumbnail */}
      <button
        type="button"
        onClick={() => onPreview?.(t)}
        className="relative block aspect-[16/10] w-full overflow-hidden bg-surface-2 text-left"
        title={`Preview ${t.name}`}
      >
        <TemplateThumbnail
          previewImage={t.preview_image}
          accentColor={accentColor}
          backgroundColor={backgroundColor}
          cardStyle={cardStyle}
          templateName={t.name}
        />

        {/* Bottom dim so the hover gradient never washes the thumbnail */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />

        {/* Top row: visibility (left), PRO + favorite (right) */}
        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center justify-between">
          <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground-secondary backdrop-blur">
            {t.visibility}
          </span>
          <div className="pointer-events-auto flex items-center gap-1.5">
            {showProBadge ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-primary backdrop-blur"
                title={`Premium required: ${t.premium_features?.join(', ')}`}
              >
                <IconCrown className="size-2.5" />
                PRO
              </span>
            ) : null}
            {onFavorite ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onFavorite(t)
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-full bg-black/55 backdrop-blur transition hover:bg-black/75 ${
                  favorited ? 'text-amber-400' : 'text-foreground-secondary hover:text-amber-300'
                }`}
                title={favorited ? 'Remove from favorites' : 'Add to favorites'}
              >
                <IconStar className={`size-4 ${favorited ? 'fill-current' : ''}`} />
              </button>
            ) : null}
          </div>
        </div>
      </button>

      {/* Content */}
      <div className="space-y-3 p-4">
        <div>
          <h3 className="truncate text-base font-semibold text-foreground">{t.name}</h3>
          {t.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
          ) : null}
        </div>

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 4).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onTagClick?.(tag)
                }}
                disabled={!onTagClick}
                className="rounded-md border border-primary/15 bg-accent-soft px-2 py-0.5 text-[10px] text-primary transition hover:border-primary/40 hover:bg-primary/15 disabled:cursor-default disabled:hover:border-primary/15 disabled:hover:bg-accent-soft"
              >
                {tag}
              </button>
            ))}
            {tags.length > 4 ? (
              <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground">
                +{tags.length - 4}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          {t.author?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={t.author.avatar_url}
              alt=""
              className="h-5 w-5 rounded-full object-cover ring-1 ring-border-strong"
            />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-[8px] text-foreground-secondary">
              {t.author?.username?.[0]?.toUpperCase() || '?'}
            </span>
          )}
          <span className="truncate">
            by <b className="text-foreground-secondary">{t.author?.username || 'user'}</b>
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="flex items-center gap-1" title={`Applied ${t.uses_count} times`}>
            <IconDownload className="size-3" />
            {t.uses_count}
          </span>
          {onLike ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onLike(t)
              }}
              className={`ml-auto flex items-center gap-1 transition ${
                liked ? 'text-primary' : 'text-primary/60 hover:text-primary'
              }`}
              title={liked ? 'Unlike' : 'Like'}
            >
              <IconHeart className={`size-3.5 ${liked ? 'fill-current' : ''}`} />
              {t.likes_count}
            </button>
          ) : (
            <span className="ml-auto flex items-center gap-1 text-primary/60">
              <IconHeart className="size-3.5" />
              {t.likes_count}
            </span>
          )}
        </div>

        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            onClick={() => onPreview?.(t)}
            className="flex-1 rounded-xl border border-border bg-surface-2 text-xs text-foreground-secondary hover:bg-surface-3 hover:text-foreground"
          >
            <IconEye className="mr-1.5 size-3.5" />
            Preview
          </Button>

          {onApply ? (
            <Button
              onClick={() => onApply(t)}
              disabled={busy}
              className="rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-md shadow-primary/30 hover:bg-primary/90"
              title={showProBadge ? 'Premium required' : 'Apply this template'}
            >
              {busy ? (
                <IconLoader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <IconDownload className="mr-1.5 size-3.5" />
                  Apply
                </>
              )}
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="rounded-xl border border-border bg-surface-2 px-3 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                title="More actions"
              >
                <IconDotsVertical className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-border bg-surface text-foreground"
            >
              {onCopyLink ? (
                <DropdownMenuItem onClick={() => onCopyLink(t)} className="cursor-pointer text-foreground-secondary focus:bg-surface-2 focus:text-foreground">
                  <IconShare3 className="mr-2 size-3.5" /> Copy link
                </DropdownMenuItem>
              ) : null}
              {onDuplicate && !isOwn ? (
                <DropdownMenuItem onClick={() => onDuplicate(t)} className="cursor-pointer text-foreground-secondary focus:bg-surface-2 focus:text-foreground">
                  <IconDownload className="mr-2 size-3.5" /> Duplicate as mine
                </DropdownMenuItem>
              ) : null}
              {isOwn && onEdit ? (
                <DropdownMenuItem onClick={() => onEdit(t)} className="cursor-pointer text-foreground-secondary focus:bg-surface-2 focus:text-foreground">
                  <IconPencil className="mr-2 size-3.5" /> Edit details
                </DropdownMenuItem>
              ) : null}
              {isOwn && onVisibilityToggle ? (
                <DropdownMenuItem onClick={() => onVisibilityToggle(t)} className="cursor-pointer text-foreground-secondary focus:bg-surface-2 focus:text-foreground">
                  <IconEye className="mr-2 size-3.5" />
                  {t.visibility === 'public' ? 'Make private' : 'Make public'}
                </DropdownMenuItem>
              ) : null}
              {!isOwn && onReport ? (
                <>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem onClick={() => onReport(t)} className="cursor-pointer text-amber-300 focus:bg-amber-500/10 focus:text-amber-200">
                    <IconFlag className="mr-2 size-3.5" /> Report
                  </DropdownMenuItem>
                </>
              ) : null}
              {(isOwn || isAdmin) && onDelete ? (
                <>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem onClick={() => onDelete(t)} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
                    <IconTrash className="mr-2 size-3.5" /> Delete
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
