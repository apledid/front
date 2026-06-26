import { NextResponse } from 'next/server'
import { writeFile, readFile, mkdir, readdir, unlink, rm, stat } from 'fs/promises'
import { join as pathJoin, resolve as pathResolve } from 'path'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateFileSignature, getMimeTypeFromExtension, maxUploadBytes } from '@/lib/file-validation'
import { withRateLimit, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 60

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || '/var/lib/halo-uploads'
const CHUNK_ROOT = pathJoin(UPLOAD_ROOT, '.tmp')

// Allowed upload types
const ALLOWED_TYPES = new Set(['avatar', 'banner', 'background', 'music', 'cursor', 'font', 'button-media', 'badge-media', 'favicon', 'embed-image'])

// Max file size (25MB)
const MAX_FILE_SIZE = 25 * 1024 * 1024

function safeUploadId(id: string): string {
  // Defence-in-depth: uploadId is generated server-side at init, but we
  // refuse anything that could escape the chunk dir if a caller forges one.
  return /^[a-zA-Z0-9._-]+$/.test(id) ? id : ''
}

function chunkDirFor(uploadId: string): string {
  return pathJoin(CHUNK_ROOT, uploadId)
}

async function cleanupChunks(uploadId: string): Promise<void> {
  try {
    await rm(chunkDirFor(uploadId), { recursive: true, force: true })
  } catch {
    // best effort
  }
}

// Sweep abandoned uploads. A client that calls init + PUT but never finalize
// leaves its chunk-staging dir on disk forever; with no scheduled job that
// accumulates unbounded. Run opportunistically on every POST: delete expired
// DB rows, then remove any chunk dir whose mtime is older than an hour (well
// past the 30-min expiry). The mtime sweep catches both expired-but-tracked
// and fully orphaned dirs without cross-referencing the table.
async function sweepExpiredUploads(supabase: ReturnType<typeof createAdminClient>): Promise<void> {
  try {
    await supabase.from('chunked_uploads').delete().lt('expires_at', new Date().toISOString())
  } catch { /* best effort */ }
  try {
    const cutoff = Date.now() - 60 * 60 * 1000
    const entries = await readdir(CHUNK_ROOT, { withFileTypes: true }).catch(() => [] as any[])
    for (const ent of entries) {
      if (typeof ent.isDirectory === 'function' && !ent.isDirectory()) continue
      const p = pathJoin(CHUNK_ROOT, ent.name)
      try {
        const st = await stat(p)
        if (st.mtimeMs < cutoff) await rm(p, { recursive: true, force: true })
      } catch { /* ignore one bad dir */ }
    }
  } catch { /* best effort */ }
}

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

    // Opportunistic GC of abandoned chunk dirs / expired rows (fire-and-forget).
    void sweepExpiredUploads(supabase)

    if (action === 'init') {
      const { filename, contentType, size, type, totalChunks } = body

      if (!type || !ALLOWED_TYPES.has(type)) {
        return NextResponse.json({ error: 'Invalid upload type' }, { status: 400 })
      }

      if (typeof size === 'number' && size > maxUploadBytes(type)) {
        return NextResponse.json({ error: `File too large. Max ${(maxUploadBytes(type) / 1024 / 1024).toFixed(0)}MB for a ${type}.` }, { status: 400 })
      }
      // Sanity-bound the declared chunk count so a forged value can't be stored
      // or used to probe absurd chunk indexes. 25MB at a >=256KB client chunk
      // size is well under 200 chunks.
      const declaredChunks = Number(totalChunks)
      if (!Number.isInteger(declaredChunks) || declaredChunks < 1 || declaredChunks > 1000) {
        return NextResponse.json({ error: 'Invalid chunk count' }, { status: 400 })
      }

      // Generate unique upload ID (alphanumeric + safe chars only)
      const uploadId = `${profile.id.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}-${Math.random().toString(36).slice(2)}`

      // Pre-create chunk staging dir so PUT writes have a target
      await mkdir(chunkDirFor(uploadId), { recursive: true })

      const { error: insertError } = await supabase
        .from('chunked_uploads')
        .insert({
          upload_id: uploadId,
          user_id: profile.id,
          filename,
          content_type: contentType,
          file_size: size,
          upload_type: type,
          total_chunks: declaredChunks,
          uploaded_chunks: 0,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        })

      if (insertError) {
        console.error('[upload-chunked] Failed to create upload record:', insertError)
        await cleanupChunks(uploadId)
        return NextResponse.json({ error: 'Failed to initialize upload' }, { status: 500 })
      }

      return NextResponse.json({ uploadId })
    }

    if (action === 'finalize') {
      const { uploadId: rawUploadId, filename, contentType, type } = body
      const uploadId = safeUploadId(rawUploadId || '')
      if (!uploadId) {
        return NextResponse.json({ error: 'Invalid upload id' }, { status: 400 })
      }

      const { data: uploadRecord, error: fetchError } = await supabase
        .from('chunked_uploads')
        .select('*')
        .eq('upload_id', uploadId)
        .single()

      if (fetchError || !uploadRecord) {
        return NextResponse.json({ error: 'Upload not found or expired' }, { status: 404 })
      }

      if (uploadRecord.user_id !== profile.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      if (new Date(uploadRecord.expires_at) < new Date()) {
        await supabase.from('chunked_uploads').delete().eq('upload_id', uploadId)
        await cleanupChunks(uploadId)
        return NextResponse.json({ error: 'Upload expired' }, { status: 410 })
      }

      // Read chunks from disk
      const dir = chunkDirFor(uploadId)
      let chunkFiles: string[]
      try {
        chunkFiles = (await readdir(dir)).filter(f => f.startsWith('chunk_')).sort()
      } catch {
        return NextResponse.json({ error: 'No chunks found' }, { status: 400 })
      }

      if (chunkFiles.length !== uploadRecord.total_chunks) {
        return NextResponse.json({
          error: `Missing chunks. Expected ${uploadRecord.total_chunks}, got ${chunkFiles.length}`,
        }, { status: 400 })
      }

      // Enforce the REAL assembled size against MAX_FILE_SIZE. The init check
      // only saw the client-declared `size`, which a malicious client can
      // understate. Bail as soon as the running total exceeds the cap so we
      // never buffer (or store) an oversized file.
      const chunkBuffers: Buffer[] = []
      let totalBytes = 0
      for (const name of chunkFiles) {
        const buf = await readFile(pathJoin(dir, name))
        totalBytes += buf.length
        if (totalBytes > maxUploadBytes(uploadRecord.upload_type)) {
          await cleanupChunks(uploadId)
          await supabase.from('chunked_uploads').delete().eq('upload_id', uploadId)
          return NextResponse.json({ error: 'File too large for this upload type.' }, { status: 400 })
        }
        chunkBuffers.push(buf)
      }
      const combinedBuffer = Buffer.concat(chunkBuffers)

      // Resolve from the extension first (curated allowlist; browsers report
      // fonts as octet-stream/empty), fall back to the sent content-type.
      const effectiveType = getMimeTypeFromExtension(filename || '') || contentType || 'application/octet-stream'

      const isValidSignature = validateFileSignature(combinedBuffer, effectiveType)
      if (!isValidSignature) {
        console.log('[upload-chunked] Invalid file signature for type:', effectiveType, 'filename:', filename)
        await cleanupChunks(uploadId)
        await supabase.from('chunked_uploads').delete().eq('upload_id', uploadId)
        return NextResponse.json({
          error: 'File type does not match the file content. Please upload a valid file.',
        }, { status: 400 })
      }

      // Write final file to disk
      const sanitizedName = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
      const pathname = `${type}/${profile.id}/${Date.now()}-${sanitizedName}`
      const fullPath = pathJoin(UPLOAD_ROOT, pathname)

      // Traversal guard
      if (!pathResolve(fullPath).startsWith(pathResolve(UPLOAD_ROOT) + '/')) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
      }

      await mkdir(pathJoin(fullPath, '..'), { recursive: true })
      await writeFile(fullPath, combinedBuffer)

      await cleanupChunks(uploadId)
      await supabase.from('chunked_uploads').delete().eq('upload_id', uploadId)

      const fileUrl = `/api/file?pathname=${encodeURIComponent(pathname)}`

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
        pathname,
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
    // Rate-limit per-chunk uploads. The POST handler (init/finalize)
    // was already on the 'upload' bucket but PUT was wide open, which
    // let a verified user hammer chunks at line-rate to consume disk
    // IO and the chunk-staging area under UPLOAD_ROOT/.tmp. Sharing
    // the same bucket as POST means a single upload session burns
    // its budget across init + chunks + finalize; that's correct,
    // an attacker spamming chunks should bump into the same ceiling
    // as someone spamming init.
    const rl = await withRateLimit(request, 'upload')
    if (rl.response) return rl.response

    const profile = await getApiUser()
    if (!profile) {
      return NextResponse.json({ error: 'Please log in to upload files' }, { status: 401 })
    }

    const formData = await request.formData()
    const chunk = formData.get('chunk') as Blob | null
    const rawUploadId = formData.get('uploadId') as string
    const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10)
    const uploadId = safeUploadId(rawUploadId || '')

    if (!chunk || !uploadId || isNaN(chunkIndex)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: uploadRecord, error: fetchError } = await supabase
      .from('chunked_uploads')
      .select('user_id, total_chunks, expires_at')
      .eq('upload_id', uploadId)
      .single()

    if (fetchError || !uploadRecord) {
      return NextResponse.json({ error: 'Upload not found or expired' }, { status: 404 })
    }

    if (uploadRecord.user_id !== profile.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (new Date(uploadRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Upload expired' }, { status: 410 })
    }

    if (chunkIndex < 0 || chunkIndex >= uploadRecord.total_chunks) {
      return NextResponse.json({ error: 'Invalid chunk index' }, { status: 400 })
    }

    const chunkBuffer = Buffer.from(await chunk.arrayBuffer())
    // No single chunk should exceed the whole-file limit; reject early so a
    // client can't stage an oversized blob on disk before finalize runs.
    if (chunkBuffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Chunk too large' }, { status: 400 })
    }
    const dir = chunkDirFor(uploadId)
    await mkdir(dir, { recursive: true })
    const chunkName = `chunk_${String(chunkIndex).padStart(4, '0')}`
    await writeFile(pathJoin(dir, chunkName), chunkBuffer)

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
