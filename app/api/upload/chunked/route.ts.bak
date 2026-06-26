import { put, del, list, get } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateFileSignature, getMimeTypeFromExtension } from '@/lib/file-validation'
import { withRateLimit, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 60

// Allowed upload types
const ALLOWED_TYPES = new Set(['avatar', 'banner', 'background', 'music', 'cursor', 'font', 'button-media', 'badge-media', 'favicon', 'embed-image'])

// Max file size (25MB)
const MAX_FILE_SIZE = 25 * 1024 * 1024

// POST: Initialize upload or finalize upload
export async function POST(request: Request) {
  try {
    const rl = await withRateLimit(request, 'upload')
    if (rl.response) return rl.response

    const profile = await getApiUser()
    if (!profile) {
      return NextResponse.json({ error: 'Please log in to upload files' }, { status: 401 })
    }

    if (!profile.email_verified) {
      return NextResponse.json({ error: 'Please verify your email before uploading' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body
    const supabase = createAdminClient()

    if (action === 'init') {
      // Initialize a new chunked upload
      const { filename, contentType, size, type, totalChunks } = body

      if (!type || !ALLOWED_TYPES.has(type)) {
        return NextResponse.json({ error: 'Invalid upload type' }, { status: 400 })
      }

      if (size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File too large. Maximum size is 25MB.' }, { status: 400 })
      }

      // Generate unique upload ID
      const uploadId = `${profile.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`

      // Store metadata in Supabase (more reliable than blob for metadata)
      const { error: insertError } = await supabase
        .from('chunked_uploads')
        .insert({
          upload_id: uploadId,
          user_id: profile.id,
          filename,
          content_type: contentType,
          file_size: size,
          upload_type: type,
          total_chunks: totalChunks,
          uploaded_chunks: 0,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry
        })

      if (insertError) {
        console.error('[upload-chunked] Failed to create upload record:', insertError)
        return NextResponse.json({ error: 'Failed to initialize upload' }, { status: 500 })
      }

      return NextResponse.json({ uploadId })
    }

    if (action === 'finalize') {
      // Finalize the upload - combine chunks and save to Blob
      const { uploadId, filename, contentType, type } = body

      // Fetch metadata from Supabase
      const { data: uploadRecord, error: fetchError } = await supabase
        .from('chunked_uploads')
        .select('*')
        .eq('upload_id', uploadId)
        .single()

      if (fetchError || !uploadRecord) {
        return NextResponse.json({ error: 'Upload not found or expired' }, { status: 404 })
      }

      // Verify ownership
      if (uploadRecord.user_id !== profile.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      // Check expiry
      if (new Date(uploadRecord.expires_at) < new Date()) {
        await supabase.from('chunked_uploads').delete().eq('upload_id', uploadId)
        return NextResponse.json({ error: 'Upload expired' }, { status: 410 })
      }

      // Fetch all chunks from Blob
      const chunkPrefix = `_chunks/${uploadId}/chunk_`
      const chunkBlobs = await list({ prefix: chunkPrefix })
      
      if (chunkBlobs.blobs.length !== uploadRecord.total_chunks) {
        return NextResponse.json({ 
          error: `Missing chunks. Expected ${uploadRecord.total_chunks}, got ${chunkBlobs.blobs.length}` 
        }, { status: 400 })
      }

      // Sort chunks by index
      const sortedChunks = chunkBlobs.blobs.sort((a, b) => {
        const aIndex = parseInt(a.pathname.split('chunk_')[1], 10)
        const bIndex = parseInt(b.pathname.split('chunk_')[1], 10)
        return aIndex - bIndex
      })

      // Download chunks using get() for private blobs
      const chunkBuffers: Buffer[] = []
      for (const chunkBlob of sortedChunks) {
        const response = await get(chunkBlob.pathname, { access: 'private' })
        const arrayBuffer = await new Response(response.stream).arrayBuffer()
        chunkBuffers.push(Buffer.from(arrayBuffer))
      }

      const combinedBuffer = Buffer.concat(chunkBuffers)

      // Resolve effective MIME type. The client sends `contentType` from
      // file.type which is sometimes empty (Discord/clipboard sources),
      // so fall back to the filename extension. Storing the right type is
      // critical: a blob saved as octet-stream won't render as a GIF/image.
      const effectiveType = contentType || getMimeTypeFromExtension(filename || '') || 'application/octet-stream'

      // Validate file signature to prevent malicious uploads
      const isValidSignature = validateFileSignature(combinedBuffer, effectiveType)
      if (!isValidSignature) {
        console.log('[upload-chunked] Invalid file signature for type:', effectiveType, 'filename:', filename)
        // Clean up temporary chunks before rejecting
        for (const chunkBlob of chunkBlobs.blobs) {
          try {
            await del(chunkBlob.url)
          } catch {
            // Ignore cleanup errors
          }
        }
        // Delete the upload record
        await supabase.from('chunked_uploads').delete().eq('upload_id', uploadId)

        return NextResponse.json({
          error: 'File type does not match the file content. Please upload a valid file.'
        }, { status: 400 })
      }

      // Upload final file to Vercel Blob
      const sanitizedName = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
      const pathname = `${type}/${profile.id}/${Date.now()}-${sanitizedName}`

      const blob = await put(pathname, combinedBuffer, {
        access: 'private',
        contentType: effectiveType,
        addRandomSuffix: false,
      })

      // Clean up temporary chunks
      for (const chunkBlob of chunkBlobs.blobs) {
        try {
          await del(chunkBlob.url)
        } catch {
          // Ignore cleanup errors
        }
      }

      // Delete the upload record
      await supabase.from('chunked_uploads').delete().eq('upload_id', uploadId)

      // Log the upload
      const fileUrl = `/api/file?pathname=${encodeURIComponent(blob.pathname)}`

      try {
        await supabase
          .from('upload_logs')
          .insert({
            user_id: profile.id,
            file_type: type,
            file_url: fileUrl,
            file_size: combinedBuffer.length,
            ip_address: getClientIp(request),
            user_agent: request.headers.get('user-agent') || 'unknown',
          })
      } catch {
        // Ignore logging errors
      }

      return NextResponse.json({
        url: fileUrl,
        pathname: blob.pathname,
        filename: sanitizedName,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[upload-chunked] Chunked upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

// PUT: Upload a chunk
export async function PUT(request: Request) {
  try {
    const profile = await getApiUser()
    if (!profile) {
      return NextResponse.json({ error: 'Please log in to upload files' }, { status: 401 })
    }

    const formData = await request.formData()
    const chunk = formData.get('chunk') as Blob | null
    const uploadId = formData.get('uploadId') as string
    const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10)

    if (!chunk || !uploadId || isNaN(chunkIndex)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify the upload exists in Supabase
    const supabase = createAdminClient()
    const { data: uploadRecord, error: fetchError } = await supabase
      .from('chunked_uploads')
      .select('user_id, total_chunks, expires_at')
      .eq('upload_id', uploadId)
      .single()

    if (fetchError || !uploadRecord) {
      return NextResponse.json({ error: 'Upload not found or expired' }, { status: 404 })
    }

    // Verify ownership
    if (uploadRecord.user_id !== profile.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check expiry
    if (new Date(uploadRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Upload expired' }, { status: 410 })
    }

    // Validate chunk index
    if (chunkIndex < 0 || chunkIndex >= uploadRecord.total_chunks) {
      return NextResponse.json({ error: 'Invalid chunk index' }, { status: 400 })
    }

    // Store the chunk in Vercel Blob
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer())
    await put(`_chunks/${uploadId}/chunk_${String(chunkIndex).padStart(4, '0')}`, chunkBuffer, {
      access: 'private',
      addRandomSuffix: false,
    })

    // Update uploaded chunks count
    await supabase
      .from('chunked_uploads')
      .update({ uploaded_chunks: chunkIndex + 1 })
      .eq('upload_id', uploadId)

    return NextResponse.json({ success: true, chunkIndex })
  } catch (error) {
    console.error('[upload-chunked] Chunk upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chunk upload failed' },
      { status: 500 }
    )
  }
}
