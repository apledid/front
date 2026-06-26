export type UploadType =
  | 'avatar'
  | 'banner'
  | 'background'
  | 'music'
  | 'cursor'
  | 'font'
  | 'button-media'
  | 'badge-media'
  | 'favicon'
  | 'embed-image'
  | 'click-sound'
  | 'enter-sound'

interface UploadResult {
  url: string
  pathname?: string
  filename?: string
}

// Per-type maximum file sizes. Picked so the UI hint, the helper, and the
// server-side caps in /api/upload(/chunked) all agree. If you change one,
// update the others - the validation runs at all three layers and the
// strictest one wins.
//
// `button-media` is what custom link icons + custom button icons share. We
// keep it tight at 5 MB so people can't slap a 25 MB animated GIF on a
// 32px button and tank everyone's profile load time.
export const MAX_SIZE_BY_TYPE: Record<UploadType, number> = {
  // Videos upload at full quality (no in-browser compression). The cap is
  // 25 MB across the board - big enough for a short high-quality background
  // clip, small enough to keep profile loads fast and disk usage in check.
  avatar:         25 * 1024 * 1024,
  banner:         25 * 1024 * 1024,
  background:     25 * 1024 * 1024,
  music:          25 * 1024 * 1024,
  cursor:          5 * 1024 * 1024,
  font:            4 * 1024 * 1024,
  'button-media': 25 * 1024 * 1024,
  'badge-media':  10 * 1024 * 1024,
  favicon:         4 * 1024 * 1024,
  'embed-image':  25 * 1024 * 1024,
  'click-sound':   2 * 1024 * 1024,
  'enter-sound':   2 * 1024 * 1024,
}

// Hard server-side cap for the chunked-upload endpoint. Even if a future
// type sneaks in without an entry above, we never accept more than this.
const ABSOLUTE_MAX_FILE_SIZE = 25 * 1024 * 1024

// Chunk size for large files (3.5MB - safely under the 4MB Next body limit
// we set in next.config.mjs's serverActions config).
const CHUNK_SIZE = 3.5 * 1024 * 1024

// Threshold for using chunked upload - anything ≤ this goes through the
// faster direct route; bigger files stream in chunks.
const CHUNKED_THRESHOLD = 4 * 1024 * 1024

/** "5 MB", "750 KB", etc. - readable in error messages. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024)
    return `${mb % 1 === 0 ? mb.toFixed(0) : mb.toFixed(1)} MB`
  }
  return `${Math.round(bytes / 1024)} KB`
}

/** Resolve the per-type max size, with absolute-cap fallback. */
export function maxSizeFor(type: UploadType): number {
  return Math.min(MAX_SIZE_BY_TYPE[type] ?? ABSOLUTE_MAX_FILE_SIZE, ABSOLUTE_MAX_FILE_SIZE)
}

/**
 * Build the canonical user-facing message for an oversize file. Used by the
 * helper itself, and exported so UI tiles can show the limit up front
 * ("up to 5 MB") in the matching wording.
 */
export function tooLargeMessage(type: UploadType): string {
  return `File size too big, file size limit is ${formatBytes(maxSizeFor(type))}`
}

/**
 * Upload a file - uses chunked uploads for large files to bypass the
 * Next.js body limit. Videos are uploaded at their original quality (no
 * in-browser re-encode); the only gate is the per-type size cap.
 */
export async function uploadFile(
  file: File,
  type: UploadType,
  onProgress?: (progress: number) => void,
  onPhase?: (phase: 'compressing' | 'uploading') => void,
): Promise<UploadResult> {
  const limit = maxSizeFor(type)

  // Single size check - videos keep their original quality (no in-browser
  // compression), so the file as-is must fit under the per-type cap.
  if (file.size > limit) {
    throw new Error(tooLargeMessage(type))
  }

  onPhase?.('uploading')

  // For files larger than 4MB, use chunked upload
  if (file.size > CHUNKED_THRESHOLD) {
    return chunkedUpload(file, type, onProgress)
  }

  // For small files, use direct upload (faster)
  return directUpload(file, type, onProgress)
}

/**
 * Helper: parse an error response body without choking on HTML.
 * Returns a clean user-facing string for the toast layer to show.
 *
 * Centralised here so the chunked-upload flow has the same friendly
 * rate-limit + non-JSON handling as directUpload. Without it, the
 * init/finalize calls (which both hit the 'upload' rate-limit bucket
 * and can return a Retry-After header) would surface as the generic
 * "Failed to initialize upload" toast, with no indication of how long
 * to wait.
 */
async function describeFetchError(res: Response): Promise<string> {
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10)
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? `${retryAfter}s` : 'a moment'
    return `Uploading too fast - wait ${wait} and try again`
  }
  const ct = res.headers.get('Content-Type') || ''
  if (ct.includes('application/json')) {
    try {
      const data = await res.json()
      if (data?.error) return String(data.error)
    } catch { /* fall through */ }
  }
  return `Upload failed (${res.status})`
}

/**
 * Chunked upload for large files - splits file into smaller chunks
 */
async function chunkedUpload(
  file: File,
  type: UploadType,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  let uploadedChunks = 0

  // Step 1: Initialize the upload
  const initRes = await fetch('/api/upload/chunked', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
      type,
      totalChunks,
      action: 'init',
    }),
  })

  if (!initRes.ok) {
    throw new Error(await describeFetchError(initRes))
  }

  const { uploadId } = await initRes.json()

  // Step 2: Upload chunks
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    const formData = new FormData()
    formData.append('chunk', chunk)
    formData.append('uploadId', uploadId)
    formData.append('chunkIndex', String(i))
    formData.append('totalChunks', String(totalChunks))

    const chunkRes = await fetch('/api/upload/chunked', {
      method: 'PUT',
      body: formData,
    })

    if (!chunkRes.ok) {
      throw new Error(await describeFetchError(chunkRes))
    }

    uploadedChunks++
    if (onProgress) {
      onProgress(Math.round((uploadedChunks / totalChunks) * 100))
    }
  }

  // Step 3: Finalize the upload
  const finalRes = await fetch('/api/upload/chunked', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      filename: file.name,
      contentType: file.type,
      type,
      action: 'finalize',
    }),
  })

  if (!finalRes.ok) {
    throw new Error(await describeFetchError(finalRes))
  }

  const result = await finalRes.json()
  return {
    url: result.url,
    pathname: result.pathname,
    filename: file.name,
  }
}

/**
 * Direct upload for small files.
 *
 * Error handling is deliberately strict here because spam toasts from
 * upload errors caused "spams invalid response from server 20 trillion
 * times" reports - rapid uploads hit the 20-per-minute rate limit and
 * each 429 fired a fresh toast that piled up on top of itself.
 *
 *   - 429 maps to a clear "You're uploading too fast" message + the
 *     server's Retry-After hint so users know how long to wait.
 *   - Non-JSON 2xx responses (proxy / CDN error pages dressed up as
 *     200) used to surface as the cryptic "Invalid response from
 *     server" - we now check Content-Type first and surface the
 *     status text instead.
 *   - HTML error bodies on non-2xx (e.g. 502 from a misconfigured
 *     proxy) also produce a useful message instead of choking on
 *     JSON.parse.
 */
async function directUpload(
  file: File,
  type: UploadType,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(percent)
        }
      }
    }

    xhr.onload = () => {
      const contentType = xhr.getResponseHeader('Content-Type') || ''
      const looksJson = contentType.includes('application/json')

      // Specific rate-limit handling - the server sends a Retry-After
      // header in seconds. Surface a friendly message so users see
      // "wait 30s" instead of a vague network-error toast.
      if (xhr.status === 429) {
        const retryAfter = parseInt(xhr.getResponseHeader('Retry-After') || '0', 10)
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? `${retryAfter}s` : 'a moment'
        reject(new Error(`Uploading too fast - wait ${wait} and try again`))
        return
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        // 2xx but not JSON: usually means a reverse proxy / CDN swallowed
        // the request and returned an HTML status page. Treat as an
        // upstream hiccup rather than the old "Invalid response" message.
        if (!looksJson) {
          reject(new Error('Upload server returned an unexpected response. Try again in a moment.'))
          return
        }
        try {
          const data = JSON.parse(xhr.responseText)
          resolve({
            url: data.url,
            pathname: data.pathname,
            filename: data.filename,
          })
        } catch {
          reject(new Error('Upload server returned an unexpected response. Try again in a moment.'))
        }
        return
      }

      // Non-2xx. Only try to parse as JSON if it's actually JSON; an HTML
      // body would JSON.parse-fail and throw away the real status info.
      if (looksJson) {
        try {
          const data = JSON.parse(xhr.responseText)
          reject(new Error(data.error || `Upload failed (${xhr.status})`))
          return
        } catch { /* fall through */ }
      }
      reject(new Error(`Upload failed (${xhr.status})`))
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))

    xhr.open('POST', '/api/upload')
    xhr.timeout = 120000 // 2 minute timeout
    xhr.send(formData)
  })
}
