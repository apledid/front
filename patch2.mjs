import { readFile, writeFile } from 'fs/promises'

const F = '/opt/halo/website/app/api/upload/chunked/route.ts'
let s = await readFile(F, 'utf-8')

const re = /\/\/ Fetch all chunks from Blob[\s\S]*?chunkBuffers\.push\(Buffer\.from\(arrayBuffer\)\)\s*\}/

if (!re.test(s)) {
  console.error('No match — section already patched or content moved')
  process.exit(1)
}

s = s.replace(re, `// Fetch all chunks from local tmp directory
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
      }`)

await writeFile(F, s)
console.log('Patched')