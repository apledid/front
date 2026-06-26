'use client'

/**
 * REZ-ONLY haunt.gg-style template card. Shares TemplateCardProps with the
 * default TemplateCard so it drops into the same grid with zero plumbing
 * changes. Gated in app/dashboard/templates/page.tsx by
 * viewer.username === 'rez'. To make it everyone's card, flip that gate.
 *
 * Layout (mirrors haunt.gg):
 *   - full-bleed preview with a gold favorite star
 *   - author avatar + template name + @handle
 *   - icon meta row: uses, Free/Premium, likes
 *   - maroon tag pills
 *   - one translucent "Use Template" button + a kebab menu
 */

import {
  IconClock,
  IconCrown,
  IconEye,
  IconFlag,
  IconHeart,
  IconLoader2,
  IconDotsVertical,
  IconPencil,
  IconShare3,
  IconSparkles,
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
import type { TemplateCardProps } from './template-card'

export function TemplateCardHaunt({
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
  onDelete,
  onReport,
  onTagClick,
  onVisibilityToggle,
  onCopyLink,
}: TemplateCardProps) {
  const isOwn = scope === 'mine' || (viewer.id && viewer.id === t.user_id)
  const isAdmin = !!viewer.is_admin
  const needsPremium = (t.premium_features?.length ?? 0) > 0
  const accentColor = (t.config?.accent_color as string | undefined) || null
  const backgroundColor = (t.config?.background_color as string | undefined) || null
  const cardStyle = (t.config?.card_style as string | undefined) || null
  const tags = Array.isArray(t.tags) ? t.tags : []
  const handle = t.author?.username || 'user'

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-border-strong">
      {/* Preview */}
      <button
        type="button"
        onClick={() => onPreview?.(t)}
        className="relative block aspect-[16/10] w-full overflow-hidden text-left"
        title={`Preview ${t.name}`}
      >
        <TemplateThumbnail
          previewImage={t.preview_image}
          accentColor={accentColor}
          backgroundColor={backgroundColor}
          cardStyle={cardStyle}
          templateName={t.name}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Private templates get a quiet marker; public ones stay clean. */}
        {t.visibility === 'private' ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground-secondary backdrop-blur">
            private
          </span>
        ) : null}

        {onFavorite ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onFavorite(t)
            }}
            className={`absolute right-2.5 top-2.5 transition ${
              favorited ? 'text-amber-400' : 'text-foreground-secondary hover:text-amber-300'
            }`}
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.85))' }}
            title={favorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <IconStar className={`size-[18px] ${favorited ? 'fill-current' : ''}`} />
          </button>
        ) : null}
      </button>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-3.5">
        {/* Author + name */}
        <div className="flex items-center gap-2.5">
          {t.author?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={t.author.avatar_url}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border"
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-foreground-secondary">
              {handle[0]?.toUpperCase() || '?'}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold leading-tight text-foreground">{t.name}</h3>
            <p className="truncate text-xs text-muted-foreground">@{handle}</p>
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1" title={`Applied ${t.uses_count} times`}>
            <IconClock className="size-3.5 text-muted-foreground/70" /> {t.uses_count} uses
          </span>
          <span className="flex items-center gap-1" title={needsPremium ? 'Uses premium features' : 'Free template'}>
            <IconCrown className={`size-3.5 ${needsPremium ? 'text-amber-300/80' : 'text-muted-foreground/70'}`} />
            <span className={needsPremium ? 'text-amber-200/80' : ''}>{needsPremium ? 'Premium' : 'Free'}</span>
          </span>
          {onLike ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onLike(t)
              }}
              className={`flex items-center gap-1 transition ${liked ? 'text-primary' : 'hover:text-primary'}`}
              title={liked ? 'Unlike' : 'Like'}
            >
              <IconHeart className={`size-3.5 ${liked ? 'fill-current' : ''}`} /> {t.likes_count}
            </button>
          ) : (
            <span className="flex items-center gap-1">
              <IconHeart className="size-3.5" /> {t.likes_count}
            </span>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 4).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onTagClick?.(tag)
                }}
                disabled={!onTagClick}
                className="rounded-full border border-primary/15 bg-accent-soft px-2.5 py-0.5 text-[11px] text-primary transition hover:border-primary/35 hover:bg-primary/15 disabled:cursor-default disabled:hover:border-primary/15 disabled:hover:bg-accent-soft"
              >
                {tag}
              </button>
            ))}
            {tags.length > 4 ? (
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] text-muted-foreground">+{tags.length - 4}</span>
            ) : null}
          </div>
        ) : null}

        {/* Actions */}
        <div className="mt-auto flex gap-1.5 pt-1">
          {onApply ? (
            <Button
              onClick={() => onApply(t)}
              disabled={busy}
              variant="ghost"
              className="flex-1 rounded-xl border border-primary/20 bg-accent-soft text-sm font-medium text-primary hover:bg-primary/15 hover:text-primary"
              title={needsPremium && !isAdmin && !viewer.premium_active ? 'Premium required' : 'Use this template'}
            >
              {busy ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <IconSparkles className="mr-1.5 size-4" /> Use Template
                </>
              )}
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="rounded-xl border border-primary/15 bg-accent-soft px-3 text-primary/70 hover:bg-primary/15 hover:text-primary"
                title="More actions"
              >
                <IconDotsVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-border bg-surface text-foreground">
              {onPreview ? (
                <DropdownMenuItem onClick={() => onPreview(t)} className="cursor-pointer text-foreground-secondary focus:bg-surface-2 focus:text-foreground">
                  <IconEye className="mr-2 size-3.5" /> Preview
                </DropdownMenuItem>
              ) : null}
              {onCopyLink ? (
                <DropdownMenuItem onClick={() => onCopyLink(t)} className="cursor-pointer text-foreground-secondary focus:bg-surface-2 focus:text-foreground">
                  <IconShare3 className="mr-2 size-3.5" /> Copy link
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
