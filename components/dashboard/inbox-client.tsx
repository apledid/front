'use client'

import { useEffect, useState } from 'react'
import { IconCopy, IconInbox, IconLoader2, IconMailExclamation, IconShield } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { InboxMessage } from '@/lib/types'

export function InboxClient() {
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<InboxMessage[]>([])

  async function loadData() {
    setLoading(true)
    try {
      const response = await fetch('/api/inbox', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to load inbox')
      setMessages(data.messages || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load inbox')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  async function markRead(messageId: string) {
    try {
      await fetch('/api/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      })
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, read_at: message.read_at || new Date().toISOString() } : message))
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <IconLoader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-surface backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft">
              <IconInbox className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl text-foreground">Inbox</CardTitle>
              <CardDescription className="text-muted-foreground">Your purchased keys and staff messages arrive here.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length > 0 ? messages.map((message) => (
            <button
              key={message.id}
              type="button"
              onClick={() => void markRead(message.id)}
              className={`w-full rounded-[28px] border p-5 text-left transition ${message.read_at ? 'border-border bg-surface' : 'border-primary/20 bg-gradient-to-br from-accent-soft to-transparent'}`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{message.subject}</p>
                    {message.from_staff ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                        <IconShield className="size-3" /> staff
                      </span>
                    ) : null}
                    {!message.read_at ? <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">new</span> : null}
                  </div>
                  <p className="text-sm leading-6 text-foreground-secondary">{message.body}</p>
                  <p className="text-xs text-muted-foreground">{message.staff_username ? `From @${message.staff_username}` : 'System message'}</p>
                </div>
                {message.license_key ? (
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <div className="rounded-2xl border border-border bg-background/40 px-3 py-2 font-mono text-xs text-foreground-secondary">
                      {message.license_key}
                    </div>
                    <Button
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation()
                        navigator.clipboard.writeText(message.license_key || '')
                        toast.success('License copied')
                      }}
                      className="rounded-xl border-border bg-surface text-foreground-secondary hover:bg-surface-2"
                    >
                      <IconCopy className="mr-2 size-4" />
                      Copy key
                    </Button>
                  </div>
                ) : null}
              </div>
            </button>
          )) : (
            <div className="rounded-[28px] border border-dashed border-border bg-surface p-8 text-center">
              <IconMailExclamation className="mx-auto mb-4 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
