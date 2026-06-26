'use client'

import { useEffect, useState } from 'react'

/**
 * Convert bio markdown to safe HTML.
 *
 * Supported: **bold** *italic* __underline__ ~~strike~~ [text](url)
 *            # / ## / ### / #### headers, <left>/<center>/<right>
 *
 * Security model:
 *   1. The whole input is HTML-escaped first (& < >), so any user-supplied
 *      HTML becomes inert text.
 *   2. Specific markdown patterns are then re-rewritten to safe HTML.
 *   3. Only the literal alignment tags <left>/<center>/<right> are
 *      "re-allowed" - they wrap a static <div style="text-align:...">.
 *   4. [text](url) links restrict the protocol to http(s) or mailto and
 *      escape quotes inside the URL to defeat attribute-injection.
 *
 * The agent-flagged "bio markdown XSS" finding was a false positive - the
 * escape-first ordering means a user-supplied <script> arrives as
 * &lt;script&gt; before any other transformation runs.
 */
export function renderBioMarkdown(raw: string): string {
  let s = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  s = s
    .replace(/&lt;left&gt;/gi, '<div style="text-align:left">')
    .replace(/&lt;\/left&gt;/gi, '</div>')
    .replace(/&lt;center&gt;/gi, '<div style="text-align:center">')
    .replace(/&lt;\/center&gt;/gi, '</div>')
    .replace(/&lt;right&gt;/gi, '<div style="text-align:right">')
    .replace(/&lt;\/right&gt;/gi, '</div>')

  s = s.replace(/^#### (.+)$/gm, '<h4 style="font-size:1.05em;font-weight:600;margin:0.4em 0">$1</h4>')
  s = s.replace(/^### (.+)$/gm, '<h3 style="font-size:1.15em;font-weight:600;margin:0.4em 0">$1</h3>')
  s = s.replace(/^## (.+)$/gm, '<h2 style="font-size:1.3em;font-weight:700;margin:0.5em 0">$1</h2>')
  s = s.replace(/^# (.+)$/gm, '<h1 style="font-size:1.5em;font-weight:700;margin:0.5em 0">$1</h1>')

  s = s.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/__([^_]+)__/g, '<u>$1</u>')
  s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>')
  s = s.replace(/(?<!\*)\*([^\*]+)\*(?!\*)/g, '<em>$1</em>')

  // Links: [text](url) - only allow http(s):// and mailto:.
  // Escape any quotes in the URL to prevent attribute-injection XSS.
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, url: string) => {
    const isSafeProtocol = /^(https?:\/\/|mailto:)/i.test(url)
    const safe = (isSafeProtocol ? url : '#').replace(/"/g, '%22').replace(/'/g, '%27')
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">${text}</a>`
  })

  s = s.replace(/\n/g, '<br />')

  return s
}

/**
 * Cycling typewriter effect for bios. Renders the current text from
 * `texts[currentIndex]` character-by-character, holds, then deletes
 * character-by-character, then advances to the next text in the array.
 */
export function TypingBio({ texts, color, speed }: { texts: string[]; color: string; speed: number }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [displayText, setDisplayText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!texts.length) return
    const currentText = texts[currentIndex]
    const tick = isDeleting ? Math.max(16, Math.floor(speed * 0.5)) : speed

    if (!isDeleting && displayText === currentText) {
      const timeout = window.setTimeout(() => setIsDeleting(true), Math.max(300, speed * 6))
      return () => window.clearTimeout(timeout)
    }
    if (isDeleting && displayText === '') {
      const timeout = window.setTimeout(() => {
        setIsDeleting(false)
        setCurrentIndex((prev) => (prev + 1) % texts.length)
      }, Math.max(120, speed * 2))
      return () => window.clearTimeout(timeout)
    }

    const timeout = window.setTimeout(() => {
      setDisplayText((current) => isDeleting ? currentText.substring(0, current.length - 1) : currentText.substring(0, current.length + 1))
    }, tick)
    return () => window.clearTimeout(timeout)
  }, [currentIndex, displayText, isDeleting, speed, texts])

  if (!texts.length) return null
  return (
    <span style={{ color }}>
      {displayText}
      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />
    </span>
  )
}
