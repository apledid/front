'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'halo_visited'

export function NewVisitorPopup({ ownerUsername }: { ownerUsername: string }) {
  const [visible, setVisible] = useState(false)
  const [hiding, setHiding] = useState(false)

  useEffect(() => {
    // Only show if they've never been here before
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // Small delay so the profile loads first
        const t = setTimeout(() => setVisible(true), 900)
        return () => clearTimeout(t)
      }
    } catch {}
  }, [])

  function dismiss() {
    setHiding(true)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    setTimeout(() => setVisible(false), 300)
  }

  if (!visible) return null

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) dismiss() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        opacity: hiding ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'linear-gradient(145deg, #0e0e16, #12101a)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '24px',
          padding: '36px 32px 28px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(232,127,160,0.08)',
          transform: hiding ? 'scale(0.96) translateY(8px)' : 'scale(1) translateY(0)',
          transition: 'transform 0.3s ease, opacity 0.3s ease',
          textAlign: 'center',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: '20px' }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            <span style={{ color: '#fff' }}>halo</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>.</span>
            <span style={{ color: '#e87fa0' }}>rip</span>
          </span>
        </div>

        {/* Headline */}
        <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 700, margin: '0 0 10px', lineHeight: 1.3 }}>
          You just found{' '}
          <span style={{ color: '#e87fa0' }}>@{ownerUsername}</span>'s profile
        </h2>

        {/* Description */}
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', lineHeight: 1.65, margin: '0 0 28px' }}>
          halo.rip is a free platform for creating your own custom profile page. Share your links, social accounts, and more in one place. Thousands of people already have their own.
        </p>

        {/* Stats row */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          marginBottom: '28px',
          padding: '14px 0',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          {[
            { label: 'Free forever', icon: '✦' },
            { label: 'Your own link', icon: '🔗' },
            { label: 'Custom style', icon: '🎨' },
          ].map(({ label, icon }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>{icon}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Link
            href="/signup"
            onClick={() => { try { localStorage.setItem(STORAGE_KEY, '1') } catch {} }}
            style={{
              display: 'block',
              padding: '13px 20px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #9333ea, #e87fa0)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '15px',
              textDecoration: 'none',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Create your free profile →
          </Link>

          <button
            onClick={dismiss}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px',
              color: 'rgba(255,255,255,0.35)',
              fontSize: '13px',
              fontWeight: 500,
              padding: '11px 20px',
              cursor: 'pointer',
              transition: 'color 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.35)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
            }}
          >
            Maybe later
          </button>
        </div>

        {/* Fine print */}
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', margin: '16px 0 0' }}>
          No credit card required · Takes 30 seconds
        </p>
      </div>
    </div>
  )
}
