'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  IconArrowLeft,
  IconChevronRight,
  IconCrown,
  IconDownload,
  IconFlag,
  IconHeart,
  IconInfoCircle,
  IconLoader2,
  IconShare3,
  IconTag,
  IconX,
} from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { TemplateRow, TemplateCardViewer } from '@/components/templates/template-card'

interface Props {
  template: TemplateRow
  relatedTemplates: TemplateRow[]
  authorOtherCount: number
  viewer: TemplateCardViewer
  /** When true, skip all marketplace chrome and just render the embedded
   *  profile. Used by the dashboard's preview iframe modal which provides
   *  its own Apply / Open Full Screen controls outside the frame. */
  bare?: boolean
  children: React.ReactNode
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.max(0, (Date.now() - then) / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  if (diffSec < 2592000) return `${Math.floor(diffSec / 604800)}w ago`
  if (diffSec < 31536000) return `${Math.floor(diffSec / 2592000)}mo ago`
  return `${Math.floor(diffSec / 31536000)}y ago`
}

export function TemplatePreviewClient({
  template: tpl,
  relatedTemplates,
  authorOtherCount,
  viewer,
  bare = false,
  children,
}: Props) {
  const router = useRouter()
  // Bare mode: rendered inside the dashboard's preview iframe. The iframe
  // host already provides Apply / Open Full Screen, so we skip the
  // marketplace chrome and just hand the embedded profile straight through.
  if (bare) return <>{children}</>
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(tpl.likes_count || 0)

  // Hydrate the like state from /api/templates/my-reactions so the
  // heart icon fills if the user has previously liked this template.
  // Without this, the heart always starts empty on page load even
  // when the user has liked the template before.
  useEffect(() => {
    if (!viewer.id) return
    fetch('/api/templates/my-reactions', { cache: 'no-store' })
      .then((r) => r.json().catch(() => ({})))
      .then((j) => {
        if (Array.isArray(j?.liked) && j.liked.includes(tpl.id)) setLiked(true)
      })
      .catch(() => {})
  }, [tpl.id, viewer.id])
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportBusy, setReportBusy] = useState(false)

  const premiumFeatures = tpl.premium_features || []
  const needsPremium = premiumFeatures.length > 0
  // Admins / staff bypass the premium gate everywhere - card, preview
  // overlay, and the apply confirm path. Mirrors the server-side check
  // in /api/templates/apply which uses profile.premium_active and also
  // honors the is_admin flag through profile-level overrides.
  const isAdmin = !!viewer.is_admin
  const blockedByPremium = needsPremium && viewer.premium_active !== true && !isAdmin
  const isOwner = !!viewer.id && viewer.id === tpl.user_id
  const authorUsername = tpl.author?.username || 'user'

  async function handleLike() {
    if (!viewer.id) {
      toast.error('Sign in to like templates')
      return
    }
    const wasLiked = liked
    setLiked(!wasLiked)
    setLikeCount((c) => c + (wasLiked ? -1 : 1))
    try {
      const res = await fetch('/api/templates/like?kind=like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tpl.id }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed')
      if (typeof j.likes_count === 'number') setLikeCount(j.likes_count)
      setLiked(!!j.liked)
    } catch (e: any) {
      // Roll back
      setLiked(wasLiked)
      setLikeCount((c) => c + (wasLiked ? 1 : -1))
      toast.error(e.message)
    }
  }

  function handleShare() {
    const url = `${window.location.origin}/templates/preview/${tpl.id}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => toast.success('Link copied'),
        () => toast.error('Copy failed'),
      )
    } else {
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        toast.success('Link copied')
      } catch {
        toast.error('Copy failed')
      }
      ta.remove()
    }
  }

  function handleApplyClick() {
    if (!viewer.id) {
      const next = `/templates/preview/${tpl.id}`
      router.push(`/login?next=${encodeURIComponent(next)}`)
      return
    }
    if (blockedByPremium) {
      // Don't open the confirm; the gate handles itself in the right-side panel.
      toast.error('Premium required to apply this template')
      return
    }
    setConfirmOpen(true)
  }

  async function confirmApply() {
    setApplying(true)
    try {
      const res = await fetch('/api/templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tpl.id }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 402) {
          toast.error('Premium required to apply this template')
        } else {
          throw new Error(j.error || 'Failed to apply')
        }
        return
      }
      toast.success('Template applied! Redirecting...')
      setConfirmOpen(false)
      router.push('/dashboard/customize')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setApplying(false)
    }
  }

  async function submitReport() {
    if (!reportReason.trim()) {
      toast.error('Enter a reason')
      return
    }
    setReportBusy(true)
    try {
      const res = await fetch('/api/templates/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: tpl.id, reason: reportReason.trim() }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed')
      toast.success('Report submitted. Staff will review.')
      setReportOpen(false)
      setReportReason('')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setReportBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen">
      {/* The embedded live profile */}
      {children}

      {/* Top action bar - fixed at the very top, above the embedded profile */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999] flex justify-center px-3 pt-3">
        <div
          className="pointer-events-auto flex max-w-[min(100%,960px)] flex-1 items-center gap-2 rounded-2xl border border-border bg-black/75 px-3 py-2 backdrop-blur-xl"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 36px -16px rgba(0,0,0,0.8)' }}
        >
          <Link
            href="/dashboard/templates"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-foreground-secondary transition hover:bg-surface-2 hover:text-foreground"
            title="Back to templates"
          >
            <IconArrowLeft className="size-4" />
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{tpl.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                by{' '}
                <Link
                  href={`/${authorUsername}`}
                  className="text-foreground-secondary transition hover:text-primary hover:underline"
                >
                  @{authorUsername}
                </Link>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLike}
            className={`flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs transition ${
              liked
                ? 'bg-accent-soft text-primary'
                : 'text-foreground-secondary hover:bg-surface-2 hover:text-primary'
            }`}
            title={liked ? 'Unlike' : 'Like'}
          >
            <IconHeart className={`size-4 ${liked ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">{likeCount}</span>
            <span className="sm:hidden">{likeCount}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground-secondary transition hover:bg-surface-2 hover:text-foreground sm:flex"
            title="Copy link"
          >
            <IconShare3 className="size-4" />
          </button>

          {!isOwner ? (
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="hidden h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground-secondary transition hover:bg-destructive/15 hover:text-destructive sm:flex"
              title="Report"
            >
              <IconFlag className="size-4" />
            </button>
          ) : null}

          <Button
            onClick={handleApplyClick}
            disabled={applying}
            className={`h-9 rounded-xl px-4 text-xs font-semibold shadow-lg ${
              blockedByPremium
                ? 'bg-primary/40 text-primary-foreground/80 cursor-not-allowed opacity-80'
                : 'bg-primary text-primary-foreground shadow-primary/30 hover:bg-primary/90'
            }`}
            title={blockedByPremium ? 'Premium required' : 'Apply this template to your profile'}
          >
            {applying ? (
              <IconLoader2 className="size-3.5 animate-spin" />
            ) : blockedByPremium ? (
              <>
                <IconCrown className="mr-1.5 size-3.5" /> Premium
              </>
            ) : (
              <>
                <IconDownload className="mr-1.5 size-3.5" /> Apply
              </>
            )}
          </Button>

          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground-secondary transition hover:bg-surface-2 hover:text-foreground"
            title={drawerOpen ? 'Hide details' : 'Show details'}
            aria-expanded={drawerOpen}
          >
            <IconInfoCircle className="size-4" />
          </button>
        </div>
      </div>

      {/* Side drawer with template details */}
      <aside
        className={`fixed right-0 top-0 z-[9998] flex h-full w-[min(360px,92vw)] flex-col gap-4 overflow-y-auto border-l border-border bg-black/85 px-4 pb-6 pt-20 text-sm backdrop-blur-2xl transition-transform duration-300 ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ boxShadow: '-12px 0 36px -12px rgba(0,0,0,0.7)' }}
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Template details</h2>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            aria-label="Close details"
          >
            <IconX className="size-4" />
          </button>
        </div>

        {tpl.description ? (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Description</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground-secondary">{tpl.description}</p>
          </div>
        ) : null}

        {(tpl.tags?.length ?? 0) > 0 ? (
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <IconTag className="mr-1 inline size-3" /> Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(tpl.tags || []).map((tag) => (
                <Link
                  key={tag}
                  href={`/dashboard/templates?tag=${encodeURIComponent(tag)}`}
                  className="rounded-md border border-primary/20 bg-accent-soft px-2 py-1 text-[11px] text-primary transition hover:border-primary/40 hover:bg-primary/15"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Stats</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-surface px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Applied</p>
              <p className="text-base font-semibold text-foreground">{tpl.uses_count.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Likes</p>
              <p className="text-base font-semibold text-foreground">{likeCount.toLocaleString()}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-border bg-surface px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Created</p>
              <p className="text-sm font-medium text-foreground-secondary">{relativeTime(tpl.created_at)}</p>
            </div>
          </div>
        </div>

        {needsPremium ? (
          <div
            className={`rounded-xl border p-3 text-xs ${
              blockedByPremium
                ? 'border-primary/30 bg-accent-soft text-primary'
                : 'border-amber-500/20 bg-amber-500/[0.06] text-amber-200/80'
            }`}
          >
            <p className="flex items-center gap-1.5 font-semibold">
              <IconCrown className="size-3.5" /> Premium features
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              {premiumFeatures.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {blockedByPremium ? (
              <Link
                href="/dashboard/premium"
                className="mt-2 inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/20"
              >
                <IconCrown className="size-3" /> Upgrade to apply
              </Link>
            ) : null}
          </div>
        ) : null}

        {/* Author card */}
        <Link
          href={`/${authorUsername}`}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition hover:bg-surface-2"
        >
          {tpl.author?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tpl.author.avatar_url}
              alt=""
              className="h-10 w-10 rounded-full object-cover ring-1 ring-border-strong"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-sm text-foreground-secondary">
              {authorUsername[0]?.toUpperCase()}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">@{authorUsername}</p>
            <p className="text-[11px] text-muted-foreground">
              {authorOtherCount > 0
                ? `${authorOtherCount} other template${authorOtherCount === 1 ? '' : 's'}`
                : 'Author profile'}
            </p>
          </div>
          <IconChevronRight className="size-4 text-muted-foreground" />
        </Link>

        {/* Related templates */}
        {relatedTemplates.length > 0 ? (
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Related</p>
            <div className="flex flex-col gap-3">
              {relatedTemplates.slice(0, 4).map((rt) => (
                <Link
                  key={rt.id}
                  href={`/templates/preview/${rt.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2 transition hover:bg-surface-2"
                >
                  <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-black">
                    {rt.preview_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={rt.preview_image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div
                        className="h-full w-full"
                        style={{
                          backgroundColor: (rt.config?.background_color as string) || '#0b0b14',
                          backgroundImage: `radial-gradient(100% 100% at 0% 0%, ${(rt.config?.accent_color as string) || '#e87fa0'}55, transparent 60%)`,
                        }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{rt.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {rt.uses_count} applied · {rt.likes_count} likes
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </aside>

      {/* Apply confirmation modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-border bg-surface text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconDownload className="size-4 text-primary" /> Apply template?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-foreground-secondary">
              Apply <b className="text-foreground">{tpl.name}</b> to your profile?
            </p>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs text-amber-200/80">
              This replaces your current styling, social links, custom buttons, music tracks, and widgets. Your existing data
              isn't recoverable.
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={confirmApply}
                disabled={applying}
                className="flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {applying ? <IconLoader2 className="size-4 animate-spin" /> : 'Yes, apply'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)} className="rounded-xl">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report modal */}
      <Dialog
        open={reportOpen}
        onOpenChange={(o) => {
          setReportOpen(o)
          if (!o) setReportReason('')
        }}
      >
        <DialogContent className="border-border bg-surface text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconFlag className="size-4 text-destructive" /> Report Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Reporting <b className="text-foreground-secondary">{tpl.name}</b> by{' '}
              <b className="text-foreground-secondary">@{authorUsername}</b>
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value.slice(0, 500))}
              placeholder="Tell staff what's wrong with this template..."
              className="min-h-[120px] w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
            />
            <p className="text-[10px] text-muted-foreground">{reportReason.length} / 500</p>
            <div className="flex gap-2">
              <Button
                disabled={reportBusy || !reportReason.trim()}
                onClick={submitReport}
                className="flex-1 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {reportBusy ? <IconLoader2 className="size-4 animate-spin" /> : 'Submit Report'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setReportOpen(false)
                  setReportReason('')
                }}
                className="rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom strip with related templates - only when there are 2+ */}
      {relatedTemplates.length >= 2 ? (
        <div
          className={`pointer-events-none fixed inset-x-0 bottom-0 z-[9997] flex justify-center px-3 pb-3 transition-opacity duration-300 ${
            drawerOpen ? 'opacity-0 sm:opacity-100' : 'opacity-100'
          }`}
        >
          <div
            className="pointer-events-auto flex max-w-[min(100%,1080px)] flex-1 items-center gap-3 overflow-x-auto rounded-2xl border border-border bg-black/75 p-3 backdrop-blur-xl"
            style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 -12px 36px -16px rgba(0,0,0,0.7)' }}
          >
            <p className="ml-1 mr-2 shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Related
            </p>
            <div className="flex w-full min-w-0 gap-3">
              {relatedTemplates.slice(0, 6).map((rt) => (
                <RelatedMiniCard key={rt.id} template={rt} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function RelatedMiniCard({ template: t }: { template: TemplateRow }) {
  return (
    <Link
      href={`/templates/preview/${t.id}`}
      className="group flex w-44 shrink-0 flex-col gap-1.5 rounded-xl border border-border bg-surface p-1.5 transition hover:border-primary/30 hover:bg-surface-2"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-border bg-black">
        {t.preview_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.preview_image} alt={t.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              backgroundColor: (t.config?.background_color as string) || '#0b0b14',
              backgroundImage: `radial-gradient(100% 100% at 20% 10%, ${(t.config?.accent_color as string) || '#e87fa0'}55, transparent 60%)`,
            }}
          />
        )}
      </div>
      <div className="px-1.5 pb-0.5">
        <p className="truncate text-[11px] font-semibold text-foreground">{t.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {t.uses_count} applied · {t.likes_count} likes
        </p>
      </div>
    </Link>
  )
}

