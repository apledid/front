import { list } from '@vercel/blob'
import { writeFile, mkdir, stat } from 'fs/promises'
import { dirname, join } from 'path'

const ROOT = '/var/lib/halo-uploads'
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN
if (!TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN is not set')
  process.exit(1)
}

// Token format: vercel_blob_rw_<STORE_ID>_<SECRET>
const parts = TOKEN.split('_')
if (parts.length < 5 || parts[0] !== 'vercel' || parts[1] !== 'blob' || parts[2] !== 'rw') {
  console.error('Token does not match expected format vercel_blob_rw_<STORE_ID>_<SECRET>')
  process.exit(1)
}
const storeId = parts[3].toLowerCase()
console.log('Using store ID:', storeId)

const BLOB_HOST_PRIVATE = `${storeId}.private.blob.vercel-storage.com`
const BLOB_HOST_PUBLIC = `${storeId}.public.blob.vercel-storage.com`

async function fetchBlob(pathname) {
  // Try private first (most halo.rip files), then public
  for (const host of [BLOB_HOST_PRIVATE, BLOB_HOST_PUBLIC]) {
    const url = `https://${host}/${pathname}`
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN } })
    if (res.ok) return res
  }
  return null
}

let cursor, count = 0, errors = 0, skipped = 0
console.log('Starting retry to', ROOT)
console.time('total')

do {
  const r = await list({ token: TOKEN, cursor, limit: 1000 })
  for (const b of r.blobs) {
    const dest = join(ROOT, b.pathname)
    try {
      const existing = await stat(dest).catch(() => null)
      if (existing && existing.size === b.size) { skipped++; continue }
      const res = await fetchBlob(b.pathname)
      if (!res) { console.error('FAIL', b.pathname); errors++; continue }
      const buf = Buffer.from(await res.arrayBuffer())
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, buf)
      count++
      if (count % 50 === 0) console.log(count, 'files retried...')
    } catch (e) {
      console.error('EXCEPTION', b.pathname, e.message)
      errors++
    }
  }
  cursor = r.cursor
} while (cursor)

console.log('')
console.log('Done. Newly migrated:', count, 'Skipped (already had):', skipped, 'Errors:', errors)
console.timeEnd('total')
