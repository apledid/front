import { readFile, writeFile } from 'fs/promises'

const FILE = '/opt/halo/website/app/api/upload/chunked/route.ts'
let src = await readFile(FILE, 'utf-8')
let patches = 0

function tryReplace(from, to, label) {
  if (!src.includes(from)) {
    console.error('  MISS:', label)
    return false
  }
  src = src.replace(from, to)
  patches++
  console.log('  OK:  ', label)
  return true
}

console.log('Patching', FILE, '\n')

tryReplace(
  "import { put, del, list, get } from '@vercel/blob'",
  "import { writeFile as fsWriteFile, mkdir, rm as fsRm, readdir as fsReaddir, readFile as fsReadFile } from 'fs/promises'\nimport { dirname as pathDirname, join as pathJoin } from 'path'",
  '1/6 imports'
)

tryReplace(
  `      // Fetch all chunks from Blob
      const chunkPrefix = \`_chunks/\${uploadId}/chunk_\`
      const chunkBlobs = await list({ prefix: chunkPrefix })

      if (chunkBlobs.blobs.length !== uploadRecord.total_chunks) {
        return NextResponse.json({
          error: \`Missing chunks. Expected \${uploadRecord.total_chunks}, got \${chunkBlobs.blobs.length}\`
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
      }`,
  `      // Fetch all chunks from local tmp directory
      const chunkDir = pathJoin('/var/lib/halo-uploads/.tmp', uploadId)
      let chunkFiles: string[] = []
      try {
        chunkFiles = (await fsReaddir(chunkDir)).filter(f => f.startsWith('chunk_')).sort()
      } catch {
        chunkFiles = []
      }

      if (chunkFiles.length !== uploadRecord.total_chunks) {
        return NextResponse.json({
          error: \`Missing chunks. Expected \${uploadRecord.total_chunks}, got \${chunkFiles.length}\`
        }, { status: 400 })
      }

      const chunkBuffers: Buffer[] = []
      for (const chunkFile of chunkFiles) {
        chunkBuffers.push(await fsReadFile(pathJoin(chunkDir, chunkFile)))
      }`,
  '2/6 fetch chunks'
)

tryReplace(
  `        // Clean up temporary chunks before rejecting
        for (const chunkBlob of chunkBlobs.blobs) {
          try {
            await del(chunkBlob.url)
          } catch {
            // Ignore cleanup errors
          }
        }`,
  `        try {
          await fsRm(pathJoin('/var/lib/halo-uploads/.tmp', uploadId), { recursive: true, force: true })
        } catch {
          // Ignore cleanup errors
        }`,
  '3/6 cleanup on sig fail'
)

tryReplace(
  `      const blob = await put(pathname, combinedBuffer, {
        access: 'private',
        contentType: effectiveType,
        addRandomSuffix: false,
      })`,
  `      const localDest = pathJoin('/var/lib/halo-uploads', pathname)
      await mkdir(pathDirname(localDest), { recursive: true })
      await fsWriteFile(localDest, combinedBuffer)`,
  '4/6 final write'
)

tryReplace(
  `      // Clean up temporary chunks
      for (const chunkBlob of chunkBlobs.blobs) {
        try {
          await del(chunkBlob.url)
        } catch {
          // Ignore cleanup errors
        }
      }`,
  `      try {
        await fsRm(pathJoin('/var/lib/halo-uploads/.tmp', uploadId), { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }`,
  '5/6 cleanup on success'
)

tryReplace(
  `    // Store the chunk in Vercel Blob
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer())
    await put(\`_chunks/\${uploadId}/chunk_\${String(chunkIndex).padStart(4, '0')}\`, chunkBuffer, {
      access: 'private',
      addRandomSuffix: false,
    })`,
  `    const chunkBuffer = Buffer.from(await chunk.arrayBuffer())
    const chunkPath = pathJoin('/var/lib/halo-uploads/.tmp', uploadId, \`chunk_\${String(chunkIndex).padStart(4, '0')}\`)
    await mkdir(pathDirname(chunkPath), { recursive: true })
    await fsWriteFile(chunkPath, chunkBuffer)`,
  '6/6 chunk storage'
)

const blobPathnameCount = (src.match(/blob\.pathname/g) || []).length
src = src.replace(/blob\.pathname/g, 'pathname')
console.log('  OK:   blob.pathname -> pathname (' + blobPathnameCount + ' replacements)')

await writeFile(FILE, src)
console.log('\nDone. Applied', patches, 'of 6 named patches +', blobPathnameCount, 'blob.pathname rewrites')