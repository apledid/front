import { list } from '@vercel/blob'
import { writeFile, mkdir, stat } from 'fs/promises'
import { dirname, join } from 'path'

const ROOT = '/var/lib/halo-uploads'
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN
if (!TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN is not set')
  process.exit(1)
}

let cursor, count = 0, errors = 0, skipped = 0
console.log('Starting blob migration to', ROOT)
console.time('total')

do {
  const { blobs, cursor: next } = await list({ token: TOKEN, cursor, limit: 1000 })
  for (const b of blobs) {
    const dest = join(ROOT, b.pathname)
    try {
      const existing = await stat(dest).catch(() => null)
      if (existing && existing.size === b.size) { skipped++; continue }
      const res = await fetch(b.url, { headers: { Authorization: `Bearer ${TOKEN}` } })
      if (!res.ok) { console.error('FAIL', res.status, b.pathname); errors++; continue }
      const buf = Buffer.from(await res.arrayBuffer())
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, buf)
      count++
      if (count % 50 === 0) console.log(count, 'files migrated...')
    } catch (e) {
      console.error('EXCEPTION', b.pathname, e.message)
      errors++
    }
  }
  cursor = next
} while (cursor)

console.log('')
console.log('Done. Migrated:', count, 'Skipped (already had):', skipped, 'Errors:', errors)
console.timeEnd('total')
