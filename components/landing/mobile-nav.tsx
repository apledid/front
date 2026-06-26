'use client'

import { useState } from 'react'
import Link from 'next/link'

const LINKS = [
  { href: '#features', label: 'features', external: false },
  { href: '/pricing', label: 'premium', external: false },
  { href: '/leaderboard', label: 'leaderboards', external: false },
  { href: 'https://discord.gg/NgVh45gXbD', label: 'discord', external: true },
]

/**
 * Mobile-only hamburger for the landing nav. Below 640px the inline .nav-links
 * (features/premium/leaderboards/discord) are hidden by halo-theme.css with no
 * replacement, so those destinations were unreachable from the header. This
 * surfaces them - plus the auth actions - in a dropdown, and hides the cramped
 * inline auth buttons on phones.
 */
export function MobileNav({ username }: { username?: string | null }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="nav-mobile">
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className="nav-mobile-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {open ? (
        <>
          <div className="nav-mobile-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="nav-mobile-menu" onClick={() => setOpen(false)}>
            {LINKS.map((l) =>
              l.external ? (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="nav-mobile-link">{l.label}</a>
              ) : (
                <Link key={l.label} href={l.href} className="nav-mobile-link">{l.label}</Link>
              ),
            )}
            <span className="nav-mobile-divider" />
            {username ? (
              <>
                <Link href="/dashboard" className="nav-mobile-link">dashboard</Link>
                <Link href={`/${username}`} className="nav-mobile-link nav-mobile-link-accent">my profile</Link>
              </>
            ) : (
              <>
                <Link href="/login" className="nav-mobile-link">sign in</Link>
                <Link href="/signup" className="nav-mobile-link nav-mobile-link-accent">claim handle</Link>
              </>
            )}
          </div>
        </>
      ) : null}

      <style>{`
        .nav-mobile { display: none; }
        .nav-mobile-toggle { display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 11px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05); color: #fff; cursor: pointer; }
        .nav-mobile-backdrop { position: fixed; inset: 0; z-index: 55; }
        .nav-mobile-menu { position: absolute; top: 52px; right: 0; min-width: 190px; display: flex; flex-direction: column; gap: 2px; padding: 8px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); background: rgba(14,11,17,0.97); backdrop-filter: blur(18px); box-shadow: 0 18px 44px -14px rgba(0,0,0,0.75); z-index: 60; }
        .nav-mobile-link { display: block; padding: 11px 13px; border-radius: 10px; color: rgba(255,255,255,0.82); font-size: 15px; text-decoration: none; }
        .nav-mobile-link:hover { background: rgba(255,255,255,0.07); color: #fff; }
        .nav-mobile-link-accent { color: #e87fa0; }
        .nav-mobile-divider { height: 1px; margin: 6px 4px; background: rgba(255,255,255,0.1); }
        @media (max-width: 640px) {
          .nav-mobile { display: block; position: relative; }
          .navbar .nav-auth { display: none !important; }
        }
      `}</style>
    </div>
  )
}
