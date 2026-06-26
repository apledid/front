'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { IconThumbUp, IconThumbUpFilled, IconThumbDown, IconThumbDownFilled } from '@tabler/icons-react'
import { toast } from 'sonner'
import { HoverTooltip } from '@/components/profile/parts/hover-tooltip'

type Vote = 'like' | 'dislike' | null

/**
 * Profile like / dislike control - a pair of thumb buttons pinned to the card.
 * Each thumb shows its live count in an on-site hover tooltip ("Like (49)" /
 * "Dislike (4)"). Counts + the viewer's own stance are pulled on mount; clicks
 * toggle optimistically and require a signed-in halo account. Inert in the
 * dashboard live preview (no real visitor session).
 */
export function LikeDislike({
  username,
  initialLikes = 0,
  initialDislikes = 0,
  accentColor = '#e87fa0',
  previewMode = false,
  isMobile = false,
  style,
}: {
  username: string
  initialLikes?: number
  initialDislikes?: number
  accentColor?: string
  previewMode?: boolean
  isMobile?: boolean
  style?: CSSProperties
}) {
  const [likes, setLikes] = useState(initialLikes)
  const [dislikes, setDislikes] = useState(initialDislikes)
  const [vote, setVote] = useState<Vote>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (previewMode || !username) return
    let cancelled = false
    fetch(`/api/profile/like?u=${encodeURIComponent(username)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        if (typeof d.likes === 'number') setLikes(d.likes)
        if (typeof d.dislikes === 'number') setDislikes(d.dislikes)
        if (d.vote === 'like' || d.vote === 'dislike' || d.vote === null) setVote(d.vote)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [username, previewMode])

  const react = useCallback(
    async (action: 'like' | 'dislike') => {
      if (previewMode || busy) return
      const prev = { likes, dislikes, vote }

      // Optimistic update mirroring the server's mutual-exclusion logic.
      let nextVote: Vote
      let nextLikes = likes
      let nextDislikes = dislikes
      if (action === 'like') {
        if (vote === 'like') { nextVote = null; nextLikes-- }
        else { nextVote = 'like'; nextLikes++; if (vote === 'dislike') nextDislikes-- }
      } else {
        if (vote === 'dislike') { nextVote = null; nextDislikes-- }
        else { nextVote = 'dislike'; nextDislikes++; if (vote === 'like') nextLikes-- }
      }
      setVote(nextVote)
      setLikes(Math.max(0, nextLikes))
      setDislikes(Math.max(0, nextDislikes))
      setBusy(true)

      const revert = () => { setLikes(prev.likes); setDislikes(prev.dislikes); setVote(prev.vote) }
      try {
        const res = await fetch('/api/profile/like', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ u: username, action }),
        })
        if (res.status === 401) {
          revert()
          toast.error('Sign in to react to profiles')
          return
        }
        const d = await res.json().catch(() => null)
        if (!res.ok || !d) {
          revert()
          if (d?.error) toast.error(d.error)
          return
        }
        if (typeof d.likes === 'number') setLikes(d.likes)
        if (typeof d.dislikes === 'number') setDislikes(d.dislikes)
        if (d.vote === 'like' || d.vote === 'dislike' || d.vote === null) setVote(d.vote)
      } catch {
        revert()
      } finally {
        setBusy(false)
      }
    },
    [previewMode, busy, likes, dislikes, vote, username],
  )

  const sizeCls = isMobile ? 'h-5 w-5' : 'h-5 w-5'
  // Mobile gets a larger tap area (>=40px: 20px icon + 2*10px padding) so the
  // adjacent thumbs aren't mis-tapped; desktop stays compact.
  const btnCls =
    `pointer-events-auto flex items-center justify-center rounded-lg ${isMobile ? 'p-2.5' : 'p-1.5'} transition-colors disabled:cursor-default`

  return (
    <div className={`pointer-events-none absolute z-[31] flex items-center ${isMobile ? 'gap-1' : 'gap-0.5'}`} style={style}>
      <HoverTooltip label={`Like (${likes})`}>
        <button
          type="button"
          aria-label="Like profile"
          aria-pressed={vote === 'like'}
          disabled={busy}
          onClick={() => react('like')}
          className={`${btnCls} ${vote === 'like' ? '' : 'text-white/55 hover:text-white/90'}`}
          style={vote === 'like' ? { color: accentColor } : undefined}
        >
          {vote === 'like' ? <IconThumbUpFilled className={sizeCls} /> : <IconThumbUp className={sizeCls} stroke={2} />}
        </button>
      </HoverTooltip>
      <HoverTooltip label={`Dislike (${dislikes})`}>
        <button
          type="button"
          aria-label="Dislike profile"
          aria-pressed={vote === 'dislike'}
          disabled={busy}
          onClick={() => react('dislike')}
          className={`${btnCls} ${vote === 'dislike' ? 'text-white' : 'text-white/55 hover:text-white/90'}`}
        >
          {vote === 'dislike' ? <IconThumbDownFilled className={sizeCls} /> : <IconThumbDown className={sizeCls} stroke={2} />}
        </button>
      </HoverTooltip>
    </div>
  )
}
