import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join as pathJoin, resolve as pathResolve } from 'path'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit, getClientIp } from '@/lib/rate-limit'
import { validateFileSignature, getMimeTypeFromExtension, maxUploadBytes } from '@/lib/file-validation'
import { getFreeEventActive } from '@/lib/get-free-event-active'

export const maxDuration = 60

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || '/var/lib/halo-uploads'

// Require verified email to upload content
const REQUIRE_VERIFIED_EMAIL = true

const ALLOWED_TYPES = new Set(['avatar', 'banner', 'background', 'music', 'cursor', 'font', 'button-media', 'badge-media', 'favicon', 'embed-image', 'click-sound', 'enter-sound'])

const PROFILE_FIELD_BY_TYPE: Record<string, string> = {
  avatar: 'avatar_url',
  banner: 'banner_url',
  background: 'background_url',
  cursor: 'custom_cursor_url',
  music: 'music_url',
  font: 'custom_font_url',
  favicon: 'favicon_url',
  'embed-image': 'embed_image_url',
  'click-sound': 'click_sound_url',
  'enter-sound': 'enter_sound_url',
}

// Direct upload route handles files up to 4MB. Anything larger should go
// through /api/upload/chunked which streams chunks to disk and concatenates
// on finalize - this keeps the Node process from buffering huge formdata
// in memory.
const MAX_FILE_SIZE = 4 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'upload')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) {
      return NextResponse.json({ error: 'Please log in to upload files' }, { status: 401 })
    }

    if (REQUIRE_VERIFIED_EMAIL && !profile.email_verified) {
      return NextResponse.json({
        error: 'Please verify your email before uploading content. Go to your dashboard to add and verify your email.'
      }, { status: 403 })
    }

    let formData
    try {
      formData = await request.formData()
    } catch (formError) {
      console.error('[upload] form data parse error:', formError)
      return NextResponse.json({
        error: 'Failed to process upload. File may be too large for direct upload (max 4MB). Large files use chunked upload automatically.'
      }, { status: 413 })
    }

    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!type || !ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: 'Invalid upload type' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `File too large for direct upload (${(file.size / 1024 / 1024).toFixed(1)}MB). Use chunked upload.`
      }, { status: 413 })
    }

    // Per-type cap (favicon/cursor/etc. must be small even under the 4MB
    // direct-upload ceiling). Backgrounds/music keep the full allowance.
    const typeCap = maxUploadBytes(type)
    if (file.size > typeCap) {
      return NextResponse.json({
        error: `This file is too large for a ${type} (max ${(typeCap / 1024 / 1024).toFixed(0)}MB).`
      }, { status: 413 })
    }

    // Resolve the effective MIME type. Browsers don't always set file.type
    // (Discord drag-and-drop, clipboard paste, some Android pickers all
    // produce empty / generic type strings - fonts especially come through as
    // application/octet-stream or empty). Resolve from the file extension first
    // (our curated allowlist, and exactly how /api/file serves the bytes back);
    // the browser-provided file.type is only a fallback for unknown extensions.
    const effectiveType = getMimeTypeFromExtension(file.name) || file.type || 'application/octet-stream'

    // Magic-byte signature check before we touch disk.
    const fileBuffer = await file.arrayBuffer()
    const isValidSignature = validateFileSignature(fileBuffer, effectiveType)
    if (!isValidSignature) {
      console.warn('[upload] invalid file signature for type:', effectiveType, 'filename:', file.name)
      return NextResponse.json({
        error: 'File type does not match the file content. Please upload a valid file.'
      }, { status: 400 })
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pathname = `${type}/${profile.id}/${Date.now()}-${sanitizedName}`
    
    // Added turbopackIgnore comments here to bypass Vercel's NFT full-project tracing error
    const fullPath = pathJoin(/*turbopackIgnore: true*/ UPLOAD_ROOT, pathname)

    // Traversal guard with turbopackIgnore comments added to prevent loose string analysis
    if (!pathResolve(/*turbopackIgnore: true*/ fullPath).startsWith(pathResolve(/*turbopackIgnore: true*/ UPLOAD_ROOT) + '/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    try {
      await mkdir(pathJoin(/*turbopackIgnore: true*/ fullPath, '..'), { recursive: true })
      await writeFile(fullPath, Buffer.from(fileBuffer))
    } catch (uploadError) {
      console.error('[upload] disk write error:', uploadError)
      return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 503 })
    }

    const fileUrl = `/api/file?pathname=${encodeURIComponent(pathname)}`

    // Log + auto-update the matching profile column. Fire-and-forget so the
    // client gets the URL immediately.
    const ip = getClientIp(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'

    let supabase
    try {
      supabase = createAdminClient()
    } catch (adminError) {
      console.error('[upload] failed to create admin client:', adminError)
      return NextResponse.json({
        url: fileUrl,
        pathname,
        filename: sanitizedName,
      })
    }

    ;(async () => {
      try {
        await supabase
          .from('upload_logs')
          .insert({
            user_id: profile.id,
            file_type: type,
            file_url: fileUrl,
            file_size: file.size,
            ip_address: ip,
            user_agent: userAgent,
          })
      } catch (err) {
        console.error('[upload] failed to log upload:', err)
      }
    })()

    const profileField = PROFILE_FIELD_BY_TYPE[type]
    // favicon + embed image are premium-only (Profile Metadata). Don't persist
    // those columns for non-premium users who hit /api/upload directly (the UI
    // page is premium-gated, but the API was not). The file still uploads and
    // the URL is returned; we just don't set the premium field - mirroring the
    // gate /api/appearance and /api/profile already enforce.
    let canWriteField = !!profileField
    if (profileField === 'favicon_url' || profileField === 'embed_image_url') {
      canWriteField = (profile as any).premium_active === true || (await getFreeEventActive())
    }
    // Click + entrance sounds are premium-only (same gate as favicon / embed
    // image above). The file still uploads and the URL is returned regardless;
    // we just don't persist the column for non-premium users.
    if (profileField === 'click_sound_url' || profileField === 'enter_sound_url') {
      canWriteField = (profile as any).premium_active === true || (await getFreeEventActive())
    }
    if (profileField && canWriteField) {
      ;(async () => {
        try {
          await supabase
            .from('profiles')
            .update({
              [profileField]: fileUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id)
        } catch {
          // Ignore profile update errors
        }
      })()
    }

    return NextResponse.json({
      url: fileUrl,
      pathname,
      filename: sanitizedName,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('[upload] unexpected error:', errorMessage, errorStack)
    return NextResponse.json({
      error: 'Upload failed',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}
