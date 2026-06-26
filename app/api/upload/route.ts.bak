import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit, getClientIp } from '@/lib/rate-limit'
import { validateFileSignature, getMimeTypeFromExtension } from '@/lib/file-validation'

// Route segment config for larger uploads
export const maxDuration = 60 // Allow up to 60 seconds for uploads

// Require verified email to upload content
const REQUIRE_VERIFIED_EMAIL = true

const ALLOWED_TYPES = new Set(['avatar', 'banner', 'background', 'music', 'cursor', 'font', 'button-media', 'badge-media', 'favicon', 'embed-image'])

const PROFILE_FIELD_BY_TYPE: Record<string, string> = {
  avatar: 'avatar_url',
  banner: 'banner_url',
  background: 'background_url',
  cursor: 'custom_cursor_url',
  music: 'music_url',
  font: 'custom_font_url',
  favicon: 'favicon_url',
  'embed-image': 'embed_image_url',
}

// This direct upload route is for small files only (under 4MB)
// Large files should use the chunked upload route
const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB (Vercel serverless body limit)

export async function POST(request: Request) {
  try {
    // Rate limit: 10 uploads per minute per IP
    const rateLimit = await withRateLimit(request, 'upload')
    if (rateLimit.response) return rateLimit.response

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN
    if (!blobToken) {
      console.error('[upload] BLOB_READ_WRITE_TOKEN not configured')
      return NextResponse.json(
        { error: 'Upload storage is not configured. Please try again later.' },
        { status: 500 },
      )
    }

    const profile = await getApiUser()
    if (!profile) {
      return NextResponse.json({ error: 'Please log in to upload files' }, { status: 401 })
    }

    // Require verified email to upload (prevent abuse)
    if (REQUIRE_VERIFIED_EMAIL && !profile.email_verified) {
      return NextResponse.json({ 
        error: 'Please verify your email before uploading content. Go to your dashboard to add and verify your email.' 
      }, { status: 403 })
    }

    let formData
    try {
      formData = await request.formData()
    } catch (formError) {
      // This error often means the file is too large for serverless
      console.error('[upload] form data parse error:', formError)
      return NextResponse.json({
        error: 'Failed to process upload. File may be too large for direct upload (max 4MB). Large files are uploaded automatically using chunked upload.'
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

    // Check file size - large files should use chunked upload
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File too large for direct upload (${(file.size / 1024 / 1024).toFixed(1)}MB). Please use a smaller file or wait for chunked upload.`
      }, { status: 413 })
    }

    // Resolve the effective MIME type. Browsers don't always set file.type
    // (Discord drag-and-drop, clipboard paste, some Android pickers all
    // produce empty type strings). When that happens we fall back to the
    // file extension so GIFs et al. don't end up stored as octet-stream and
    // refuse to render later. A blob with the wrong content-type is the
    // root cause of "GIF upload doesn't show but webp works" reports.
    const effectiveType = file.type || getMimeTypeFromExtension(file.name) || 'application/octet-stream'

    // Validate file signature (magic number) to prevent malicious uploads
    const fileBuffer = await file.arrayBuffer()
    const isValidSignature = validateFileSignature(fileBuffer, effectiveType)
    if (!isValidSignature) {
      console.warn('[upload] invalid file signature for type:', effectiveType, 'filename:', file.name)
      return NextResponse.json({
        error: 'File type does not match the file content. Please upload a valid file.'
      }, { status: 400 })
    }

    // Upload directly without transcoding for speed and stability
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pathname = `${type}/${profile.id}/${Date.now()}-${sanitizedName}`

    let blob
    try {
      blob = await put(pathname, Buffer.from(fileBuffer), {
        access: 'private',
        token: blobToken,
        addRandomSuffix: false,
        contentType: effectiveType,
      })
    } catch (uploadError) {
      console.error('[upload] blob upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 503 })
    }

    // Use /api/file route to serve private blobs
    const fileUrl = `/api/file?pathname=${encodeURIComponent(blob.pathname)}`

    // Log the upload for security tracking
    const ip = getClientIp(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'

    let supabase
    try {
      supabase = createAdminClient()
    } catch (adminError) {
      console.error('[upload] failed to create admin client:', adminError)
      // Don't fail the upload, just skip logging
      return NextResponse.json({
        url: fileUrl,
        pathname: blob.pathname,
        filename: sanitizedName,
      })
    }
    
    // Log upload asynchronously (don't await, just fire and forget)
    (async () => {
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

    // Update profile field in background (don't await, just fire and forget)
    const profileField = PROFILE_FIELD_BY_TYPE[type]
    if (profileField) {
      (async () => {
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
      pathname: blob.pathname,
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
