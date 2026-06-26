'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  IconChevronDown,
  IconCopy,
  IconEye,
  IconFlag,
  IconHeart,
  IconStack2,
  IconLoader2,
  IconPlus,
  IconSearch,
  IconAdjustmentsHorizontal,
  IconDiamond,
  IconStar,
  IconX,
} from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type TemplateRow, type TemplateCardViewer } from '@/components/templates/template-card'
import { TemplateCardHaunt } from '@/components/templates/template-card-haunt'
import { TemplateFormModal, type TemplateFormMode } from '@/components/templates/template-form-modal'

type Scope = 'library' | 'favorites' | 'mine'
type SortMode = 'trending' | 'most_liked' | 'newest' | 'most_used'
type PremiumFilter = 'all' | 'free' | 'pro'

const PAGE_SIZE = 24

const SORT_LABELS: Record<SortMode, string> = {
  trending: 'Trending',
  most_liked: 'Most liked',
  newest: 'Newest',
  most_used: 'Most used',
}

const PREMIUM_LABELS: Record<PremiumFilter, string> = {
  all: 'All',
  free: 'Free',
  pro: 'Pro',
}

/* ─── small UI atoms (mirror the customize page rhythm) ─── */

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  right,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-accent-soft">
        <Icon className="size-5 text-primary" />
      </span>
      <div className="flex-1 min-w-[200px]">
        <h1 className="text-[1.6rem] font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  )
}

/* ─── skeleton card while initial fetch settles ─── */

function CardSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-surface"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.5)' }}
    >
      <div className="aspect-[16/10] w-full animate-pulse bg-surface-3" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-surface-3" />
        <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTag = searchParams.get('tag') || ''
  const initialScope = (searchParams.get('scope') as Scope) || 'library'

  const [scope, setScope] = useState<Scope>(['library', 'favorites', 'mine'].includes(initialScope) ? initialScope : 'library')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('trending')
  const [tagFilter, setTagFilter] = useState<string[]>(initialTag ? initialTag.split(',').map((t) => t.trim()).filter(Boolean) : [])
  const [premiumFilter, setPremiumFilter] = useState<PremiumFilter>('all')

  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  // Captures the last fetch error so the grid can render an inline
  // retry instead of just toasting it once and leaving the page empty.
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [viewer, setViewer] = useState<TemplateCardViewer>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [preview, setPreview] = useState<TemplateRow | null>(null)
  const [reportTarget, setReportTarget] = useState<TemplateRow | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  // Form modal: handles create / edit / duplicate from one component.
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<TemplateFormMode>('create')
  const [formSource, setFormSource] = useState<TemplateRow | null>(null)

  // Styled confirm dialog replaces the jarring native window.confirm()
  // for apply / delete / visibility toggle. One shared state since at
  // most one confirm is open at a time. The action callback runs when
  // the user clicks the primary button; clearing the state closes the
  // dialog regardless.
  type ConfirmKind = 'apply' | 'delete' | 'visibility'
  const [confirmState, setConfirmState] = useState<{
    kind: ConfirmKind
    template: TemplateRow
    nextVisibility?: 'public' | 'private'
  } | null>(null)

  // Track optimistic liked/favorited state so the heart/star fill flips
  // immediately on click. We don't fetch the initial state from the
  // server today; assume false until the user toggles.
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set())
  const [favoritedSet, setFavoritedSet] = useState<Set<string>>(new Set())

  /* ─── debounce search input ─── */
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  /* ─── viewer (current user) + their reaction sets ─── */
  useEffect(() => {
    // Fetch the viewer first, then their liked/favorited template IDs.
    // Running in parallel because the reactions endpoint is independent
    // of /api/profile - both keyed on the session cookie server-side.
    Promise.all([
      fetch('/api/profile', { cache: 'no-store' }).then((r) => r.json().catch(() => ({}))),
      fetch('/api/templates/my-reactions', { cache: 'no-store' }).then((r) => r.json().catch(() => ({}))),
    ])
      .then(([profileJson, reactionsJson]) => {
        if (profileJson?.profile) {
          setViewer({
            id: profileJson.profile.id,
            username: profileJson.profile.username,
            premium_active: !!profileJson.profile.premium_active,
            is_admin: !!(profileJson.profile.is_admin || profileJson.profile.username === 'rez'),
          })
        }
        // Hydrate the reaction sets so heart + star icons fill on
        // mount instead of starting empty. Critical UX bug: without
        // this, refreshing the page made the user think their likes
        // had been lost.
        if (Array.isArray(reactionsJson?.liked)) {
          setLikedSet(new Set(reactionsJson.liked as string[]))
        }
        if (Array.isArray(reactionsJson?.favorited)) {
          setFavoritedSet(new Set(reactionsJson.favorited as string[]))
        }
      })
      .catch(() => {})
  }, [])

  /* ─── data fetch ─── */
  const buildQuery = useCallback(
    (p: number) => {
      const params = new URLSearchParams()
      params.set('scope', scope === 'library' ? 'public' : scope)
      if (search) params.set('q', search)
      if (scope === 'library') {
        params.set('sort', sort)
        if (tagFilter.length) params.set('tag', tagFilter.join(','))
        if (premiumFilter !== 'all') params.set('premium', premiumFilter)
        params.set('page', String(p))
        params.set('pageSize', String(PAGE_SIZE))
      }
      return params.toString()
    },
    [scope, search, sort, tagFilter, premiumFilter],
  )

  const fetchPage = useCallback(
    async (p: number, append: boolean) => {
      const res = await fetch(`/api/templates?${buildQuery(p)}`, { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || 'Failed to load templates')
      const next = j.templates || []
      setTemplates((prev) => (append ? [...prev, ...next] : next))
      setTotal(typeof j.total === 'number' ? j.total : next.length)
      setPage(p)
    },
    [buildQuery],
  )

  useEffect(() => {
    setLoading(true)
    setFetchError(null)
    fetchPage(1, false)
      .catch((e) => {
        const msg = e?.message || 'Failed to load templates'
        setFetchError(msg)
        toast.error(msg)
      })
      .finally(() => setLoading(false))
  }, [fetchPage])

  /* ─── infinite scroll ─── */
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    if (scope !== 'library') return // pagination only on library scope
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        if (loading || loadingMore) return
        if (templates.length >= total) return
        setLoadingMore(true)
        fetchPage(page + 1, true)
          .catch((e) => toast.error(e.message || 'Failed'))
          .finally(() => setLoadingMore(false))
      },
      { rootMargin: '300px' },
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [scope, page, total, templates.length, loading, loadingMore, fetchPage])

  /* ─── URL sync for tag filter so /dashboard/templates?tag=minimal
         deep-links straight into a filtered view ─── */
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (tagFilter.length) params.set('tag', tagFilter.join(','))
    else params.delete('tag')
    if (scope !== 'library') params.set('scope', scope)
    else params.delete('scope')
    const next = params.toString()
    const cur = searchParams.toString()
    if (next !== cur) router.replace(`/dashboard/templates${next ? '?' + next : ''}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagFilter, scope])

  /* ─── card action handlers ─── */

  function handleTagClick(tag: string) {
    setTagFilter((prev) => (prev.includes(tag) ? prev : [...prev, tag]))
    setScope('library')
  }

  function handlePreview(t: TemplateRow) {
    setPreview(t)
  }

  function handleApply(t: TemplateRow) {
    if (!viewer.id) {
      toast.error('Sign in to apply templates')
      return
    }
    // Admins bypass the premium gate (mirrors the card + preview overlay).
    if ((t.premium_features?.length ?? 0) > 0 && !viewer.premium_active && !viewer.is_admin) {
      toast.error('This template uses premium features. Upgrade to apply.')
      return
    }
    // Open the styled confirm dialog instead of native window.confirm().
    setConfirmState({ kind: 'apply', template: t })
  }

  async function doApply(t: TemplateRow) {
    setBusyId(t.id)
    try {
      const res = await fetch('/api/templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id }),
      })
      const j = await res.json()
      if (!res.ok) {
        if (res.status === 402) {
          toast.error('Premium required. Upgrade to apply this template.')
        } else {
          throw new Error(j.error || 'Failed')
        }
        return
      }
      // Optimistic uses_count bump so the card reflects the apply
      // without a full reload. Server-side already incremented it.
      setTemplates((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, uses_count: (x.uses_count || 0) + 1 } : x)),
      )
      toast.success('Template applied. Refresh your profile to see it.')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleLike(t: TemplateRow) {
    if (!viewer.id) {
      toast.error('Sign in to like templates')
      return
    }
    const wasLiked = likedSet.has(t.id)
    setLikedSet((prev) => {
      const n = new Set(prev)
      if (wasLiked) n.delete(t.id)
      else n.add(t.id)
      return n
    })
    setTemplates((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, likes_count: x.likes_count + (wasLiked ? -1 : 1) } : x)),
    )
    try {
      const res = await fetch('/api/templates/like?kind=like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed')
      // Sync to server's truth in case our optimistic guess was wrong.
      if (typeof j.likes_count === 'number') {
        setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, likes_count: j.likes_count } : x)))
      }
      setLikedSet((prev) => {
        const n = new Set(prev)
        if (j.liked) n.add(t.id)
        else n.delete(t.id)
        return n
      })
    } catch (e: any) {
      // Roll back optimistic state
      setLikedSet((prev) => {
        const n = new Set(prev)
        if (wasLiked) n.add(t.id)
        else n.delete(t.id)
        return n
      })
      toast.error(e.message)
    }
  }

  async function handleFavorite(t: TemplateRow) {
    if (!viewer.id) {
      toast.error('Sign in to favorite templates')
      return
    }
    const wasFav = favoritedSet.has(t.id)
    setFavoritedSet((prev) => {
      const n = new Set(prev)
      if (wasFav) n.delete(t.id)
      else n.add(t.id)
      return n
    })
    try {
      const res = await fetch('/api/templates/like?kind=favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed')
      toast.success(j.liked ? 'Saved to favorites' : 'Removed from favorites')
    } catch (e: any) {
      setFavoritedSet((prev) => {
        const n = new Set(prev)
        if (wasFav) n.add(t.id)
        else n.delete(t.id)
        return n
      })
      toast.error(e.message)
    }
  }

  function handleDelete(t: TemplateRow) {
    setConfirmState({ kind: 'delete', template: t })
  }

  async function doDelete(t: TemplateRow) {
    setBusyId(t.id)
    try {
      const res = await fetch('/api/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed')
      setTemplates((prev) => prev.filter((x) => x.id !== t.id))
      toast.success('Template deleted')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusyId(null)
    }
  }

  function handleCopyLink(t: TemplateRow) {
    const url = `${window.location.origin}/templates/preview/${t.id}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => toast.success('Link copied'),
        () => toast.error('Copy failed'),
      )
    } else {
      // Legacy fallback
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

  function handleReport(t: TemplateRow) {
    setReportTarget(t)
  }

  async function submitReport() {
    if (!reportTarget || !reportReason.trim()) {
      toast.error('Enter a reason')
      return
    }
    setReportBusy(true)
    try {
      const res = await fetch('/api/templates/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: reportTarget.id, reason: reportReason.trim() }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed')
      toast.success('Report submitted. Staff will review.')
      setReportTarget(null)
      setReportReason('')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setReportBusy(false)
    }
  }

  /* ─── authoring handlers (open the shared form modal) ─── */

  function openCreate() {
    setFormMode('create')
    setFormSource(null)
    setFormOpen(true)
  }

  function handleEdit(t: TemplateRow) {
    setFormMode('edit')
    setFormSource(t)
    setFormOpen(true)
  }

  function handleDuplicate(t: TemplateRow) {
    setFormMode('duplicate')
    setFormSource(t)
    setFormOpen(true)
  }

  function handleVisibilityToggle(t: TemplateRow) {
    const next: 'public' | 'private' = t.visibility === 'public' ? 'private' : 'public'
    setConfirmState({ kind: 'visibility', template: t, nextVisibility: next })
  }

  async function doVisibilityToggle(t: TemplateRow, next: 'public' | 'private') {
    setBusyId(t.id)
    try {
      const res = await fetch('/api/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, visibility: next }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed')
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, visibility: next } : x)))
      toast.success(`Template is now ${next}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusyId(null)
    }
  }

  function handleFormSuccess(saved: TemplateRow) {
    if (formMode === 'edit') {
      // Patch the row in-place so the card updates without a reload.
      setTemplates((prev) => prev.map((x) => (x.id === saved.id ? { ...x, ...saved } : x)))
    } else {
      // create + duplicate both produce a brand-new owned template.
      setScope('mine')
    }
  }

  /* ─── derived ─── */
  // Everyone gets the haunt.gg-style card.
  const CardComponent = TemplateCardHaunt
  const hasMore = scope === 'library' && templates.length < total
  const emptyMessage = useMemo(() => {
    if (scope === 'mine') return "You haven't saved any templates yet. Hit Create Template to snapshot your current profile."
    if (scope === 'favorites') return 'No favorites yet. Star any template you love to keep it here.'
    if (search || tagFilter.length || premiumFilter !== 'all') return 'No templates match your filters. Try clearing tags or switching sort.'
    return 'No templates yet.'
  }, [scope, search, tagFilter, premiumFilter])

  return (
    <div className="space-y-6 pb-12">
      {/* Page header */}
      <SectionHeading
        icon={IconStack2}
        title="Templates"
        subtitle="Browse, share, and remix profile looks. Apply any template in one click."
        right={
          <Button
            onClick={openCreate}
            className="rounded-xl px-5 py-5 font-semibold"
          >
            <IconPlus className="mr-2 h-4 w-4" /> Create Template
          </Button>
        }
      />

      {/* Scope tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-2xl border border-border bg-surface p-1">
          {(['library', 'favorites', 'mine'] as Scope[]).map((s) => {
            const active = scope === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  active
                    ? 'bg-accent-soft text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground-secondary'
                }`}
              >
                {s === 'library' ? (
                  <IconStack2 className="h-3.5 w-3.5" />
                ) : s === 'favorites' ? (
                  <IconStar className="h-3.5 w-3.5" />
                ) : (
                  <IconHeart className="h-3.5 w-3.5" />
                )}
                {s === 'library' ? 'Library' : s === 'favorites' ? 'Favorites' : 'My Uploads'}
                {/* Library: total result count when active. Mine: x/cap
                    slot indicator when active so users see how close they
                    are to the template cap before hitting the API error. */}
                {s === 'library' && total > 0 && active ? (
                  <span className="ml-1 rounded-full bg-white/10 px-1.5 text-[10px] font-mono text-foreground-secondary">{total}</span>
                ) : s === 'mine' && active ? (
                  <span className="ml-1 rounded-full bg-white/10 px-1.5 text-[10px] font-mono text-foreground-secondary">
                    {templates.length}/{viewer.premium_active || viewer.is_admin ? 10 : 3}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {/* Toolbar (Library scope only) */}
      {scope === 'library' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative min-w-[220px] flex-1">
              <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search templates..."
                className="h-11 rounded-2xl pl-10 pr-10"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground-secondary"
                  aria-label="Clear search"
                >
                  <IconX className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {/* Sort dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-11 rounded-2xl border border-border bg-surface px-4 text-sm font-medium text-foreground-secondary hover:bg-surface-2 hover:text-foreground"
                >
                  <IconAdjustmentsHorizontal className="mr-2 size-3.5" />
                  Sort: <b className="ml-1 text-foreground">{SORT_LABELS[sort]}</b>
                  <IconChevronDown className="ml-2 size-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-border bg-surface text-foreground">
                {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
                  <DropdownMenuItem
                    key={m}
                    onClick={() => setSort(m)}
                    className={`cursor-pointer text-foreground-secondary focus:bg-white/[0.06] focus:text-foreground ${
                      sort === m ? 'bg-accent-soft text-primary' : ''
                    }`}
                  >
                    {SORT_LABELS[m]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Premium segmented control */}
            <div className="inline-flex h-11 items-center rounded-2xl border border-border bg-surface p-1">
              {(Object.keys(PREMIUM_LABELS) as PremiumFilter[]).map((p) => {
                const active = premiumFilter === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPremiumFilter(p)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? p === 'pro'
                          ? 'bg-accent-soft text-foreground shadow-sm'
                          : 'bg-accent-soft text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground-secondary'
                    }`}
                  >
                    {p === 'pro' ? <IconDiamond className="size-3" /> : null}
                    {PREMIUM_LABELS[p]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Active tag chips */}
          {tagFilter.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tags:</span>
              {tagFilter.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter((prev) => prev.filter((x) => x !== tag))}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-primary transition hover:border-primary/50 hover:bg-primary/15"
                >
                  {tag}
                  <IconX className="size-3" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setTagFilter([])}
                className="text-[11px] text-muted-foreground underline-offset-2 transition hover:text-foreground-secondary hover:underline"
              >
                Clear all
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : fetchError && templates.length === 0 ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.04] py-16 text-center">
          <IconX className="mx-auto mb-3 size-10 text-destructive/60" />
          <p className="mb-1 text-sm font-semibold text-foreground">Couldn&apos;t load templates</p>
          <p className="mx-auto mb-4 max-w-sm text-xs text-muted-foreground">{fetchError}</p>
          <Button
            onClick={() => {
              setLoading(true)
              setFetchError(null)
              fetchPage(1, false)
                .catch((e) => {
                  const msg = e?.message || 'Failed to load templates'
                  setFetchError(msg)
                  toast.error(msg)
                })
                .finally(() => setLoading(false))
            }}
            className="rounded-xl"
          >
            Try again
          </Button>
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-2 py-16 text-center">
          {scope === 'favorites' ? (
            <IconStar className="mx-auto mb-3 size-10 text-muted-foreground/50" />
          ) : scope === 'mine' ? (
            <IconHeart className="mx-auto mb-3 size-10 text-muted-foreground/50" />
          ) : (
            <IconStack2 className="mx-auto mb-3 size-10 text-muted-foreground/50" />
          )}
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{emptyMessage}</p>
          {scope === 'mine' ? (
            <Button
              onClick={openCreate}
              className="mt-4 rounded-xl"
            >
              <IconPlus className="mr-2 size-4" /> Create your first template
            </Button>
          ) : scope === 'favorites' ? (
            <Button
              variant="secondary"
              onClick={() => setScope('library')}
              className="mt-4 rounded-xl"
            >
              <IconStack2 className="mr-2 size-4" /> Browse library
            </Button>
          ) : (search || tagFilter.length || premiumFilter !== 'all') ? (
            <Button
              variant="secondary"
              onClick={() => {
                setSearchInput('')
                setSearch('')
                setTagFilter([])
                setPremiumFilter('all')
              }}
              className="mt-4 rounded-xl"
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <CardComponent
                key={t.id}
                template={t}
                viewer={viewer}
                scope={scope}
                busy={busyId === t.id}
                liked={likedSet.has(t.id)}
                favorited={favoritedSet.has(t.id)}
                onPreview={handlePreview}
                onApply={handleApply}
                onLike={handleLike}
                onFavorite={handleFavorite}
                onEdit={t.user_id === viewer.id ? handleEdit : undefined}
                onDuplicate={viewer.id ? handleDuplicate : undefined}
                onVisibilityToggle={t.user_id === viewer.id ? handleVisibilityToggle : undefined}
                onDelete={t.user_id === viewer.id || viewer.is_admin ? handleDelete : undefined}
                onReport={t.user_id !== viewer.id && viewer.id ? handleReport : undefined}
                onCopyLink={handleCopyLink}
                onTagClick={handleTagClick}
              />
            ))}
          </div>

          {/* Infinite-scroll sentinel + tail loader */}
          {scope === 'library' ? (
            <div ref={sentinelRef} className="flex justify-center py-6">
              {loadingMore ? (
                <IconLoader2 className="size-6 animate-spin text-primary/60" />
              ) : hasMore ? (
                <span className="text-[11px] text-muted-foreground/70">Scroll for more</span>
              ) : (
                <span className="text-[11px] text-muted-foreground/60">End of results</span>
              )}
            </div>
          ) : null}
        </>
      )}

      {/* Create / Edit / Duplicate - one shared modal driven by formMode. */}
      <TemplateFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        source={formSource}
        onSuccess={handleFormSuccess}
      />

      {/* Preview modal */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent
          className="max-h-[95vh] border-border bg-surface p-0 text-foreground sm:max-w-[min(1400px,95vw)]"
        >
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="flex items-center gap-3">
              <span>{preview?.name}</span>
              {preview?.author?.username ? (
                <span className="text-xs font-normal text-muted-foreground">
                  by <b className="text-foreground-secondary">@{preview.author.username}</b>
                </span>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          {preview ? (
            <div className="flex flex-col gap-3 px-5 pb-5">
              {/* Tall iframe (75vh) so the profile renders at near-real
                  viewport dimensions instead of being squished into a
                  640px-tall band. Profiles use fixed inset-0 layout
                  that only looks right when the iframe is roughly the
                  size of an actual phone/desktop viewport.
                  ----
                  Sandbox: allow-same-origin is now ON. Without it, the
                  iframe had a null/opaque origin, which (a) broke
                  Discord-CDN avatars (some CDNs gate by Origin), (b)
                  broke cookie-bound font CSS for /_next/static assets
                  on some browsers, and (c) made every same-origin
                  fetch in client components throw. We accept the
                  trade-off because the iframe loads OUR own page from
                  OUR own origin and the template config carries no
                  executable JS - just style/URL data that is rendered
                  through React's escaping. There is no surface for a
                  template author to exfiltrate cookies via window.parent. */}
              <div className="relative h-[75vh] w-full overflow-hidden rounded-xl border border-border bg-black">
                <iframe
                  src={`/templates/preview/${preview.id}?bare=1`}
                  className="h-full w-full"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="no-referrer"
                  title={`Preview of ${preview.name}`}
                />
              </div>

              {preview.description ? <p className="text-sm text-foreground-secondary">{preview.description}</p> : null}

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-md bg-surface-2 px-2 py-1">{preview.uses_count} uses</span>
                <span className="rounded-md bg-surface-2 px-2 py-1">{preview.likes_count} likes</span>
                {(preview.tags || []).slice(0, 4).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      handleTagClick(tag)
                      setPreview(null)
                    }}
                    className="rounded-md bg-accent-soft px-2 py-1 text-primary transition hover:bg-primary/15"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {(preview.premium_features?.length ?? 0) > 0 ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300/80">
                  Uses {preview.premium_features?.length} premium feature
                  {preview.premium_features?.length === 1 ? '' : 's'}: {preview.premium_features?.join(', ')}.
                  {!viewer.premium_active ? ' Premium required to apply.' : ''}
                </div>
              ) : null}

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setPreview(null)
                    handleApply(preview)
                  }}
                  disabled={busyId === preview.id}
                  className="flex-1 rounded-xl"
                >
                  <IconCopy className="mr-2 size-4" /> Use This Template
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => window.open(`/templates/preview/${preview.id}`, '_blank')}
                  className="rounded-xl"
                >
                  <IconEye className="mr-2 size-4" /> Open Full Screen
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Report modal */}
      <Dialog
        open={!!reportTarget}
        onOpenChange={(o) => {
          if (!o) {
            setReportTarget(null)
            setReportReason('')
          }
        }}
      >
        <DialogContent className="border-border bg-surface text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconFlag className="size-4 text-destructive" />
              Report Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {reportTarget ? (
              <p className="text-xs text-muted-foreground">
                Reporting <b className="text-foreground">{reportTarget.name}</b>
                {reportTarget.author?.username ? (
                  <>
                    {' '}
                    by <b className="text-foreground">@{reportTarget.author.username}</b>
                  </>
                ) : null}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground-secondary">Reason</label>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value.slice(0, 500))}
                placeholder="Tell staff what's wrong with this template..."
                className="min-h-[120px] w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none"
              />
              <p className="text-[10px] text-muted-foreground/70">{reportReason.length} / 500</p>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={reportBusy || !reportReason.trim()}
                onClick={submitReport}
                variant="destructive"
                className="flex-1 rounded-xl"
              >
                {reportBusy ? <IconLoader2 className="size-4 animate-spin" /> : 'Submit Report'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setReportTarget(null)
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

      {/* Confirm dialog for apply / delete / visibility-toggle. Replaces
          the native window.confirm() calls that broke the dark theme and
          jumped out of the rest of the UI. */}
      <Dialog
        open={!!confirmState}
        onOpenChange={(o) => { if (!o) setConfirmState(null) }}
      >
        <DialogContent className="border-border bg-surface text-foreground sm:max-w-md">
          {confirmState ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {confirmState.kind === 'apply' ? (
                    <><IconCopy className="size-4 text-primary" /> Apply template?</>
                  ) : confirmState.kind === 'delete' ? (
                    <><IconX className="size-4 text-destructive" /> Delete template?</>
                  ) : (
                    <><IconEye className="size-4 text-amber-300" /> Change visibility?</>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {confirmState.kind === 'apply' ? (
                  <>
                    <p className="text-foreground-secondary">
                      Apply <b className="text-foreground">{confirmState.template.name}</b> to your profile?
                    </p>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs text-amber-200/80">
                      This replaces your current styling, social links, custom buttons, music tracks, and widgets. Your existing data isn&apos;t recoverable, so save a preset first if you want to keep your current look.
                    </div>
                  </>
                ) : confirmState.kind === 'delete' ? (
                  <p className="text-foreground-secondary">
                    Delete <b className="text-foreground">{confirmState.template.name}</b>? The saved template will be gone for good. This won&apos;t affect your live profile.
                  </p>
                ) : (
                  <p className="text-foreground-secondary">
                    Make <b className="text-foreground">{confirmState.template.name}</b>{' '}
                    <b className={confirmState.nextVisibility === 'public' ? 'text-emerald-300' : 'text-foreground-secondary'}>
                      {confirmState.nextVisibility}
                    </b>
                    ?{' '}
                    {confirmState.nextVisibility === 'public'
                      ? 'It will show up in the library for everyone.'
                      : 'It will only be visible to you in My Uploads.'}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    disabled={busyId === confirmState.template.id}
                    onClick={() => {
                      const state = confirmState
                      if (!state) return
                      setConfirmState(null)
                      if (state.kind === 'apply') doApply(state.template)
                      else if (state.kind === 'delete') doDelete(state.template)
                      else if (state.kind === 'visibility' && state.nextVisibility) {
                        doVisibilityToggle(state.template, state.nextVisibility)
                      }
                    }}
                    variant={confirmState.kind === 'delete' ? 'destructive' : 'default'}
                    className="flex-1 rounded-xl"
                  >
                    {busyId === confirmState.template.id ? (
                      <IconLoader2 className="size-4 animate-spin" />
                    ) : confirmState.kind === 'apply' ? (
                      'Yes, apply'
                    ) : confirmState.kind === 'delete' ? (
                      'Delete'
                    ) : (
                      `Make ${confirmState.nextVisibility}`
                    )}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmState(null)} className="rounded-xl">
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
