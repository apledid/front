/**
 * Security utilities for XSS prevention and input validation
 */

// HTML entity map for escaping special characters
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
}

/**
 * Escapes HTML special characters to prevent XSS attacks
 * Converts characters like <, >, &, ", ' to their HTML entity equivalents
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char)
}

/**
 * Sanitizes a string by removing potential script injection patterns
 * and HTML-escaping the result.
 *
 * Use this for fields that flow straight into the React text-node
 * pipeline. Do NOT use it for fields rendered through a markdown /
 * dangerouslySetInnerHTML pipeline that already escapes on render
 * (e.g. `bio`, `bio_texts`) - escaping here on top of escaping on
 * render leads to progressive `&amp;amp;...` build-up every time
 * the user re-saves the same value. For those fields use
 * `sanitizeMarkupSource` below.
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') return ''

  // Remove script tags and event handlers
  let sanitized = str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')

  return escapeHtml(sanitized)
}

/**
 * Like `sanitizeString` but does NOT HTML-escape the result. The
 * caller is expected to feed the value into a render path that
 * escapes on output (e.g. `renderBioMarkdown`).
 *
 * Why this exists: bio + bio_texts were getting HTML-escaped on
 * every save by `sanitizeString`, so a literal `>` typed in the bio
 * round-tripped as `&gt;` → `&amp;gt;` → `&amp;amp;gt;` …
 * progressively deeper with every save. The render path
 * (`renderBioMarkdown`) already escapes safely on output, so the
 * save path doesn't need to.
 */
export function sanitizeMarkupSource(str: string): string {
  if (typeof str !== 'string') return ''
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
}

/**
 * Validates and sanitizes user input based on expected type
 */
export function validateInput(value: string, type: 'text' | 'number' | 'email' | 'url' | 'username' | 'alphanumeric'): { valid: boolean; sanitized: string; error?: string } {
  if (typeof value !== 'string') {
    return { valid: false, sanitized: '', error: 'Invalid input type' }
  }

  const trimmed = value.trim()

  switch (type) {
    case 'number':
      // Only allow digits, optionally with decimal point and negative sign
      if (!/^-?\d*\.?\d+$/.test(trimmed)) {
        return { valid: false, sanitized: '', error: 'Only numbers are allowed' }
      }
      return { valid: true, sanitized: trimmed }

    case 'email':
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      if (!emailRegex.test(trimmed)) {
        return { valid: false, sanitized: '', error: 'Invalid email format' }
      }
      return { valid: true, sanitized: trimmed.toLowerCase() }

    case 'url':
      try {
        const url = new URL(trimmed)
        // Only allow http and https protocols
        if (!['http:', 'https:'].includes(url.protocol)) {
          return { valid: false, sanitized: '', error: 'Only HTTP/HTTPS URLs are allowed' }
        }
        return { valid: true, sanitized: url.toString() }
      } catch {
        return { valid: false, sanitized: '', error: 'Invalid URL format' }
      }

    case 'username':
      // Only allow alphanumeric, underscores, and hyphens
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return { valid: false, sanitized: '', error: 'Username can only contain letters, numbers, underscores, and hyphens' }
      }
      return { valid: true, sanitized: trimmed.toLowerCase() }

    case 'alphanumeric':
      // Only allow letters and numbers
      if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
        return { valid: false, sanitized: '', error: 'Only letters and numbers are allowed' }
      }
      return { valid: true, sanitized: trimmed }

    case 'text':
    default:
      // General text - sanitize but allow most characters
      return { valid: true, sanitized: sanitizeString(trimmed) }
  }
}

/**
 * Validates that a value is a positive integer
 */
export function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value) && parseInt(value, 10) > 0
}

/**
 * Validates that a value contains only digits
 */
export function isNumericOnly(value: string): boolean {
  return /^\d+$/.test(value)
}

/**
 * Strips all HTML tags from a string
 */
export function stripHtml(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replace(/<[^>]*>/g, '')
}

/**
 * Validates hex color codes
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)
}

/**
 * Sanitizes JSON input to prevent prototype pollution
 */
export function safeJsonParse<T>(json: string): T | null {
  try {
    const parsed = JSON.parse(json)
    // Prevent prototype pollution
    if (parsed && typeof parsed === 'object') {
      delete parsed.__proto__
      delete parsed.constructor
      delete parsed.prototype
    }
    return parsed as T
  } catch {
    return null
  }
}
