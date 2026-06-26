/**
 * File validation utility with magic number (file signature) checking
 * Prevents uploading malicious files disguised as images
 */

// Magic numbers (file signatures) for common file types
const FILE_SIGNATURES: Record<string, number[][]> = {
  // Images - each entry is one valid signature to check
  'image/jpeg':   [[0xFF, 0xD8, 0xFF]],
  'image/png':    [[0x89, 0x50, 0x4E, 0x47]],
  'image/gif':    [[0x47, 0x49, 0x46]],
  'image/webp':   [[0x52, 0x49, 0x46, 0x46]], // RIFF
  'image/bmp':    [[0x42, 0x4D]],

  // Video - MP4-family has variable atom sizes so only check the 'ftyp' box
  // type at bytes 4-7. webm + mkv share the EBML/Matroska header magic.
  'video/mp4':         [[]], // special-cased below (ftyp at bytes 4-7)
  'video/x-m4v':       [[]], // m4v = iTunes flavor of mp4; same ftyp check
  'video/webm':        [[0x1A, 0x45, 0xDF, 0xA3]],
  'video/x-matroska':  [[0x1A, 0x45, 0xDF, 0xA3]], // .mkv shares the EBML header
  'video/quicktime':   [[]], // .mov - special-cased below

  // Audio
  'audio/mpeg': [[0x49, 0x44, 0x33], [0xFF, 0xFB], [0xFF, 0xF3], [0xFF, 0xF2]], // ID3 or raw MP3 sync
  'audio/wav':  [[0x52, 0x49, 0x46, 0x46]], // RIFF

  // Fonts - TTF / OTF / WOFF / WOFF2
  'font/ttf':                   [[0x00, 0x01, 0x00, 0x00]],
  'font/otf':                   [[0x4F, 0x54, 0x54, 0x4F]], // OTTO
  'font/woff':                  [[0x77, 0x4F, 0x46, 0x46]],
  'font/woff2':                 [[0x77, 0x4F, 0x46, 0x32]],
  'application/font-woff':      [[0x77, 0x4F, 0x46, 0x46]],
  'application/font-woff2':     [[0x77, 0x4F, 0x46, 0x32]],
  'application/x-font-ttf':     [[0x00, 0x01, 0x00, 0x00]],
  'application/x-font-opentype':[[0x4F, 0x54, 0x54, 0x4F]],
  'application/font-sfnt':      [[0x00, 0x01, 0x00, 0x00], [0x4F, 0x54, 0x54, 0x4F]],
}

// Every valid sfnt / WOFF magic number. A real font is accepted no matter
// which subtype it was declared as: a .ttf can carry TrueType (00010000) OR
// CFF ('OTTO') outlines, legacy Mac TrueType starts with 'true', collections
// with 'ttcf', and web fonts with 'wOFF' / 'wOF2'. Browsers report fonts
// wildly (font/ttf, application/x-font-ttf, application/octet-stream, or empty)
// so we validate the bytes against this whole set for any font MIME type.
const FONT_SIGNATURES: number[][] = [
  [0x00, 0x01, 0x00, 0x00], // TrueType (sfnt 1.0)
  [0x4F, 0x54, 0x54, 0x4F], // 'OTTO' - OpenType with CFF outlines
  [0x74, 0x72, 0x75, 0x65], // 'true' - legacy Mac TrueType
  [0x74, 0x74, 0x63, 0x66], // 'ttcf' - TrueType Collection
  [0x77, 0x4F, 0x46, 0x46], // 'wOFF'
  [0x77, 0x4F, 0x46, 0x32], // 'wOF2'
]

/** Check whether bytes 4-7 spell 'ftyp' - valid for MP4 and QuickTime regardless of atom size */
function isMp4OrMov(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false
  return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
}

/**
 * MPEG audio (.mp3) signature check. A real .mp3 starts with either:
 *   - an ID3v2 tag ("ID3" = 0x49 0x44 0x33), or
 *   - a frame sync: the first 11 bits are all 1, i.e. byte0 === 0xFF and the
 *     top 3 bits of byte1 are set ((byte1 & 0xE0) === 0xE0).
 *
 * The 11-bit-sync test is the correct, format-spec way to detect MPEG audio:
 * it covers MPEG-1/2/2.5 Layer I/II/III (0xFB, 0xFA, 0xF3, 0xF2, 0xE3, ...)
 * AND AAC ADTS (0xFF 0xF1 / 0xFF 0xF9). The latter matters because TikTok
 * audio rippers like ssstik.io hand you a raw AAC stream with an .mp3
 * extension - a perfectly playable file the browser labels audio/mpeg.
 *
 * The previous check only whitelisted 0xFB/0xF3/0xF2 as the second byte, so
 * CRC-protected MP3 (0xFA), MPEG-2.5 (0xE3) and AAC-in-mp3 (0xF1/0xF9) all
 * got bounced with "File type does not match the file content."
 *
 * Being lenient here is safe: audio is served from /api/file as audio/mpeg,
 * which the browser never executes as script (unlike the SVG vector this
 * module exists to block), so a false-accept has no XSS surface.
 */
function isMpegAudio(bytes: Uint8Array): boolean {
  if (bytes.length < 3) return false
  // ID3v2-tagged
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true
  // MPEG / AAC-ADTS frame sync (first 11 bits set)
  if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return true
  return false
}

/**
 * Validate file by checking magic number (first few bytes).
 * Returns true if the file content matches the declared MIME type.
 */
export function validateFileSignature(
  buffer: ArrayBuffer | Uint8Array,
  expectedMimeType: string
): boolean {
  const bytes = buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : buffer

  if (bytes.length === 0) return false

  // SVG: rejected entirely. SVG is XML, can embed <script>, and when
  // served from our /api/file endpoint with image/svg+xml the browser
  // executes inline scripts on direct navigation - which means a
  // malicious avatar URL becomes a stored-XSS link runnable in the
  // halo.rip origin (cookies, /api/auth/me, every authed endpoint).
  // No feature on the platform actually needs SVG uploads (favicons
  // accept PNG, avatars/backgrounds accept all raster formats + video)
  // so we reject SVG at validation time instead of trying to sanitize
  // it. Also removed image/svg+xml from getMimeTypeFromExtension so
  // any historical .svg files get served as application/octet-stream
  // -> browser downloads instead of renders.
  if (expectedMimeType === 'image/svg+xml') {
    return false
  }

  // Reject markup content (SVG / HTML / XML) regardless of the declared type
  // or extension. Real binary media never starts with '<' after optional
  // leading whitespace / UTF-8 BOM (PNG=0x89, JPEG=0xFF, GIF/WEBP/WAV='G'/'R',
  // fonts=0x00/'w'/'O', mp4 ftyp). Closes the "evil.svg.png carrying
  // <svg onload=...>" bypass - the bytes can never be served as runnable
  // markup even under a mislabeled image content-type.
  {
    let i = 0
    while (
      i < bytes.length &&
      (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0A ||
       bytes[i] === 0x0D || bytes[i] === 0xEF || bytes[i] === 0xBB || bytes[i] === 0xBF)
    ) i++
    if (bytes[i] === 0x3C) return false
  }

  // MP4 / M4V / QuickTime - ftyp box at bytes 4-7. M4V is just the iTunes
  // flavor of MP4 and uses the same atom layout, so the same check applies.
  if (
    expectedMimeType === 'video/mp4' ||
    expectedMimeType === 'video/x-m4v' ||
    expectedMimeType === 'video/quicktime'
  ) {
    return isMp4OrMov(bytes)
  }

  // MP3 - accept ID3v2 tag or any MPEG/AAC frame sync (see isMpegAudio).
  // Browsers also sometimes report mp3 as audio/mp3; that type has no entry
  // in FILE_SIGNATURES and falls through to the permissive default below.
  if (expectedMimeType === 'audio/mpeg' || expectedMimeType === 'audio/mp3') {
    return isMpegAudio(bytes)
  }

  // Fonts - accept any valid sfnt/WOFF magic regardless of the declared
  // ttf/otf/woff/sfnt subtype, since the container flavor and the declared
  // type often disagree (a .ttf may hold CFF 'OTTO' outlines, etc.). The
  // markup guard above already rejected anything starting with '<'.
  if (
    expectedMimeType.startsWith('font/') ||
    expectedMimeType.startsWith('application/font') ||
    expectedMimeType.startsWith('application/x-font')
  ) {
    return FONT_SIGNATURES.some(sig => sig.every((byte, i) => bytes[i] === byte))
  }

  const signatureList = FILE_SIGNATURES[expectedMimeType]
  // No known signature for this type. Default-DENY anything that isn't a
  // recognised media MIME, so text/html, application/xml, and the
  // application/octet-stream fallback can never pass as a "valid" upload.
  // Media aliases without an explicit signature above (audio/mp3, image/jpg,
  // etc.) are still allowed by prefix - they're real media and the
  // markup-content guard already rejected anything HTML/SVG/XML.
  if (!signatureList || signatureList.length === 0) {
    return /^(image|video|audio|font)\//.test(expectedMimeType)
      || expectedMimeType.startsWith('application/font')
      || expectedMimeType.startsWith('application/x-font')
  }

  // At least one of the listed signatures must match
  return signatureList.some(sig =>
    sig.length === 0 || sig.every((byte, i) => bytes[i] === byte)
  )
}

/**
 * Get expected MIME type from file extension
 */
export function getMimeTypeFromExtension(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  const mimeMap: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    // SVG intentionally omitted - see validateFileSignature comment.
    // Any historical .svg files left in the upload root will get
    // mapped to application/octet-stream by the route handler's
    // fallback, which means the browser downloads instead of
    // rendering them - neutralising the stored-XSS vector.
    'mp4': 'video/mp4',
    'm4v': 'video/x-m4v',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'mkv': 'video/x-matroska',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    // Fonts
    'ttf':  'font/ttf',
    'otf':  'font/otf',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
  }
  return mimeMap[ext || ''] || null
}

// Per-upload-type size caps (bytes). Avatars/favicons/cursors should never be
// huge; backgrounds and music can legitimately be large (video backgrounds,
// audio tracks). Anything unlisted falls back to 25MB. Enforced by both upload
// routes so a 25MB favicon/cursor can't be staged.
const MB = 1024 * 1024
// Kept in sync with MAX_SIZE_BY_TYPE in lib/upload.ts. Videos upload at full
// quality (no compression); the cap is 25MB across the board.
const MAX_BYTES_BY_TYPE: Record<string, number> = {
  favicon: 4 * MB,
  font: 4 * MB,
  cursor: 5 * MB,
  'badge-media': 10 * MB,
  'embed-image': 25 * MB,
  music: 25 * MB,
  'click-sound': 2 * MB,
  'enter-sound': 2 * MB,
  'button-media': 25 * MB,
  avatar: 25 * MB,
  banner: 25 * MB,
  background: 25 * MB,
}
export function maxUploadBytes(type: string | null | undefined): number {
  return (type && MAX_BYTES_BY_TYPE[type]) || 25 * MB
}
