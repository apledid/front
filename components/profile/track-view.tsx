'use client'

import { useEffect } from 'react'

/**
 * Client-side view tracker.
 *
 * Replaces the previous server-side after() tracking with a JS-driven
 * confirmation: the view only counts if the visitor's browser actually
 * executes this component (i.e. is a real browser, not a script
 * hammering the URL with curl / fetch / requests / etc.) AND stays on
 * the page long enough that the timer fires.
 *
 * Combined with the cookie + subnet hash + hourly velocity cap defenses
 * in /api/track-view, this turns view-bombing into a real headless
 * browser job:
 *   - bots without JS never trigger the counter at all
 *   - bots with JS but no cookie storage get rejected at the API
 *   - bots that solve both still hit the 100/hour ceiling per profile
 *
 * The 3.5-second delay also filters out accidental clicks - if the
 * user clicked through and tabbed away within 3 seconds, the request
 * never fires, which is the right behaviour: a 1-second bounce isn't
 * really a "view".
 */
export function TrackView({ profileId }: { profileId: string }) {
  useEffect(() => {
    // sessionStorage prevents the same tab from double-counting on
    // route changes / refreshes. The server still dedupes by
    // (profile_id, visitor_hash) so this is just polite-client
    // hygiene, but it cuts harmless noise.
    const sessionKey = `halo_viewed_${profileId}`
    try {
      if (sessionStorage.getItem(sessionKey)) return
    } catch {
      // Storage blocked (privacy mode / strict cookies) - that's
      // fine, the server-side dedup still catches it.
    }

    // Visibility check: don't count tabs that opened in the
    // background and were never actually looked at. About 5-10% of
    // profile loads on shared link previews fall in this bucket.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return
    }

    const timer = window.setTimeout(() => {
      // keepalive lets the request finish even if the user navigates
      // away in the same instant. Fire-and-forget; we don't care
      // about the response.
      fetch(`/api/track-view?profileId=${encodeURIComponent(profileId)}`, {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
      }).catch(() => { /* network failure is silent */ })
      try { sessionStorage.setItem(sessionKey, '1') } catch { /* noop */ }
    }, 3500)

    return () => window.clearTimeout(timer)
  }, [profileId])

  return null
}
