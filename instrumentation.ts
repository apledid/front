// Next.js registers this hook once per server process at boot.
// We use it to install a process-wide guard for benign stream-abort errors
// that Next 16 surfaces as uncaughtException when clients disconnect
// mid-response (e.g. <video> scrubs, mobile tab close on a long asset).
// Without this, every aborted media stream pollutes logs and risks PM2
// counting restarts. The narrow filter only swallows ERR_INVALID_STATE
// from closed ReadableStream - everything else still crashes loudly.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Errors we log but never crash the process for: client stream aborts and
  // transient outbound-network blips (an upstream/CDN being briefly unreachable
  // must not take the whole server down). Anything OUTSIDE this set is treated
  // as a genuine, possibly-state-corrupting crash -> exit so PM2 restarts clean.
  const RECOVERABLE_NET_CODES = new Set([
    'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'UND_ERR_SOCKET',
  ])
  const isRecoverable = (err: unknown): boolean => {
    if (!err || typeof err !== 'object') return false
    const e = err as { code?: string; name?: string; message?: string; cause?: { code?: string } }
    if (e.code === 'ERR_INVALID_STATE') return true
    if (e.name === 'AbortError') return true
    if (e.code && RECOVERABLE_NET_CODES.has(e.code)) return true
    if (e.cause?.code && RECOVERABLE_NET_CODES.has(e.cause.code)) return true
    if (typeof e.message === 'string' &&
        (e.message.includes('ReadableStream is already closed') || e.message.includes('fetch failed'))) return true
    return false
  }

  process.on('uncaughtException', (err) => {
    if (isRecoverable(err)) { console.warn('[uncaughtException:recoverable]', (err as any)?.message); return }
    // Registering this listener overrides Node's default crash-on-error, so a
    // REAL uncaught exception would otherwise leave the process limping on in a
    // possibly-corrupt state. Log and exit so PM2 restarts a clean process.
    console.error('[uncaughtException]', err)
    process.exit(1)
  })

  process.on('unhandledRejection', (reason) => {
    if (isRecoverable(reason)) { console.warn('[unhandledRejection:recoverable]', (reason as any)?.message); return }
    console.error('[unhandledRejection]', reason)
  })
}
