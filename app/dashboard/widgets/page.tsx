'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import {
  IconLayoutGrid, IconPlus, IconTrash, IconLoader2, IconExternalLink, IconInfoCircle,
  IconAlignJustified, IconCarouselHorizontal, IconGripVertical, IconCheck, IconSelector,
} from '@tabler/icons-react'

// Full IANA timezone list, straight from the runtime. Falls back to a
// small set on the rare engine without Intl.supportedValuesOf.
const TIMEZONES: string[] = (() => {
  try {
    const tz = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone')
    if (tz?.length) return tz
  } catch { /* fall through */ }
  return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney']
})()

// Searchable IANA-timezone picker for the Time widget, mirroring haunt's
// combobox. The city label is derived from the last segment downstream.
function TimezoneCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // Substring filter ourselves (shouldFilter={false} skips cmdk's scoring).
  // Render every match - no cap, or an empty query would only ever show the
  // first ~50 zones, which are all Africa/*.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? TIMEZONES.filter((tz) => tz.toLowerCase().includes(q)) : TIMEZONES
  }, [query])
  const close = () => { setOpen(false); setQuery('') }
  return (
    // Inline (not a portaled Popover): inside the Dialog, Radix's
    // scroll-lock blocks wheel events on portaled content, so the list
    // wouldn't scroll. Rendering in-flow keeps wheel scrolling working.
    <div className="relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-surface-2 px-3 text-sm text-foreground transition-colors hover:border-border-strong"
      >
        <span className={value ? '' : 'text-muted-foreground'}>{value || 'Select a timezone'}</span>
        <IconSelector className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
          <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
            <Command shouldFilter={false} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close() } }}>
              <CommandInput
                autoFocus
                placeholder="Search timezone"
                value={query}
                onValueChange={setQuery}
                className="border-0 focus-visible:!shadow-none focus-visible:!outline-none focus-visible:!ring-0"
              />
              <CommandList className="max-h-64 overflow-y-auto p-1">
                <CommandEmpty>No timezone found.</CommandEmpty>
                {results.map((tz) => (
                  <CommandItem
                    key={tz}
                    value={tz}
                    onSelect={() => { onChange(tz); close() }}
                    className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-foreground-secondary data-[selected=true]:bg-foreground/[0.06] data-[selected=true]:text-foreground"
                  >
                    <IconCheck className={`mr-2 size-4 text-primary ${value === tz ? 'opacity-100' : 'opacity-0'}`} />
                    {tz}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </div>
        </>
      )}
    </div>
  )
}

// Brand SVG icons for each widget type - uses currentColor so the brand color flows
function BrandIcon({ id, className = 'h-5 w-5' }: { id: string; className?: string }) {
  switch (id) {
    case 'discord':
    case 'discord-server':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      )
    case 'github':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
        </svg>
      )
    case 'tiktok':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      )
    case 'lastfm':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M10.599 17.211l-.881-2.393s-1.433 1.596-3.579 1.596c-1.9 0-3.249-1.652-3.249-4.296 0-3.381 1.7-4.596 3.381-4.596 2.426 0 3.2 1.568 3.855 3.575l.88 2.755c.88 2.673 2.537 4.819 7.312 4.819 3.44 0 5.77-1.052 5.77-3.82 0-2.239-1.283-3.396-3.665-3.95l-1.768-.385c-1.227-.275-1.584-.77-1.584-1.594 0-.935.742-1.485 1.952-1.485 1.32 0 2.03.495 2.14 1.65l2.756-.33c-.22-2.485-1.94-3.51-4.73-3.51-2.48 0-4.84.935-4.84 3.925 0 1.87.907 3.05 3.18 3.6l1.88.44c1.39.33 1.92.88 1.92 1.76 0 1.046-1.01 1.485-2.95 1.485-2.865 0-4.064-1.513-4.75-3.564l-.908-2.78C12.22 7.647 10.598 5.5 6.34 5.5 2.54 5.5 0 8.1 0 12.2c0 3.97 2.43 6.3 6.01 6.3 3.1 0 4.589-1.289 4.589-1.289z"/>
        </svg>
      )
    case 'roblox':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M5.164 0L0 18.836 18.836 24 24 5.164 5.164 0zm8.124 15.96l-5.248-1.46 1.46-5.248 5.248 1.46-1.46 5.248z"/>
        </svg>
      )
    case 'valorant':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M23.793 2.115a.083.083 0 0 0-.075.045L13.293 16.13a.075.075 0 0 0 .06.12h5.13c.27 0 .516-.135.66-.36l5.04-6.98a.226.226 0 0 0 .034-.213L23.846 2.157a.083.083 0 0 0-.053-.042zM.207 2.115a.083.083 0 0 0-.054.042L0 8.697a.226.226 0 0 0 .033.213l5.04 6.98c.144.225.39.36.66.36h5.13a.075.075 0 0 0 .06-.12L.282 2.16a.083.083 0 0 0-.075-.045z"/>
        </svg>
      )
    case 'chess':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 4h8v2h2v3l-3 5v3h2v2h2v3H5v-3h2v-2h2v-3L6 9V6h2V4zm2 11v3h4v-3l3-5h-2V8H9v2H7l3 5z"/>
        </svg>
      )
    case 'weather':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6.5 20a4.5 4.5 0 1 1 .8-8.93A6 6 0 0 1 18.95 11H19a5 5 0 0 1 0 10z" opacity=".4"/>
          <path d="M19 9.05c-.16 0-.31.02-.47.04A8 8 0 0 0 4.7 8.05A6 6 0 0 0 1 13.5C1 16.54 3.46 19 6.5 19H19a5 5 0 0 0 0-10z M6.5 17C4.57 17 3 15.43 3 13.5a4 4 0 0 1 4-4l.5.04a6 6 0 0 1 11.42 1.96A3 3 0 0 1 22 14a3 3 0 0 1-3 3z"/>
          <circle cx="17.5" cy="6" r="2.5" fill="currentColor"/>
        </svg>
      )
    case 'spotify':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
    case 'statsfm':
      // stats.fm has no Simple Icons glyph - a tidy bar-chart mark reads
      // as "listening stats" and matches the rest of the set's weight.
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="11" width="4" height="10" rx="1"/><rect x="10" y="4" width="4" height="17" rx="1"/><rect x="17" y="14" width="4" height="7" rx="1"/></svg>
    case 'minecraft':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3h18v18H3V3zm2 2v6h6V5H5zm8 0v6h6V5h-6zm-8 8v6h6v-6H5zm8 0v6h6v-6h-6z"/></svg>
    case 'time':
      return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" strokeLinecap="round"/></svg>
    case 'custom':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.6 6.6L21 9.3l-5 4.3 1.6 6.4L12 16.9 6.4 20l1.6-6.4-5-4.3 6.4-.7z"/></svg>
    case 'twitch':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
    case 'youtube':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12z"/></svg>
    case 'pinterest':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/></svg>
    case 'twitter':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    case 'telegram':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
        </svg>
      )
  }
}

type Widget = {
  id: string
  type: string
  config: Record<string, any>
  enabled: boolean
  display_order: number
}

const WIDGET_TYPES = [
  { id: 'valorant',       name: 'VALORANT',         desc: 'Show your current rank, RR and level',           color: '#FF4655', fields: [{ key: 'username', label: 'Riot Name', placeholder: 'YourName' }, { key: 'tag', label: 'Tagline', placeholder: 'NA1' }] },
  { id: 'discord',        name: 'Discord Presence', desc: 'Live status, activity, Spotify (via Lanyard)',   color: '#5865F2', fields: [{ key: 'userId', label: 'Discord User ID', placeholder: '123456789012345678' }] },
  { id: 'roblox',         name: 'Roblox',           desc: 'Avatar, display name and bio',                   color: '#FF4444', fields: [{ key: 'userId', label: 'Roblox User ID', placeholder: '261' }] },
  { id: 'github',         name: 'GitHub',           desc: 'Followers, repos and recent activity',           color: '#FFFFFF', fields: [{ key: 'username', label: 'Username', placeholder: 'octocat' }] },
  { id: 'lastfm',         name: 'Last.fm',          desc: 'Now playing + recent tracks',                    color: '#D51007', fields: [{ key: 'username', label: 'Username', placeholder: 'rj' }] },
  { id: 'weather',        name: 'Weather',          desc: 'Current conditions for any city',                color: '#38BDF8', fields: [{ key: 'location', label: 'City', placeholder: 'London' }] },
  { id: 'tiktok',         name: 'TikTok',           desc: 'Live stats fetched from your TikTok profile',    color: '#FF0050', fields: [{ key: 'username', label: 'Username', placeholder: 'yourusername' }] },
  { id: 'chess',          name: 'Chess.com',        desc: 'Ratings across all time controls',               color: '#81B64C', fields: [{ key: 'username', label: 'Username', placeholder: 'magnuscarlsen' }] },
  { id: 'discord-server', name: 'Discord Server',   desc: 'Show your Discord server with member count',     color: '#5865F2', fields: [{ key: 'inviteCode', label: 'Invite Code or URL', placeholder: 'discord.gg/yourserver' }] },
  { id: 'spotify',        name: 'Spotify',          desc: 'Embed any track, album, playlist or artist',     color: '#1DB954', fields: [{ key: 'url', label: 'Spotify link', placeholder: 'https://open.spotify.com/track/...' }] },
  { id: 'minecraft',      name: 'Minecraft',        desc: 'Show your Minecraft skin + username',            color: '#5FA44B', fields: [{ key: 'username', label: 'Username', placeholder: 'Notch' }] },
  { id: 'time',           name: 'Time',             desc: 'A live clock in any timezone',                   color: '#60A5FA', fields: [{ key: 'timezone', label: 'Timezone (IANA)', placeholder: 'America/New_York' }, { key: 'label', label: 'Label (optional)', placeholder: 'My time', optional: true }] },
  { id: 'custom',         name: 'Custom',           desc: 'Your own title, text, image and link',           color: '#E87FA0', fields: [{ key: 'title', label: 'Title', placeholder: 'My link' }, { key: 'subtitle', label: 'Subtitle (optional)', placeholder: 'Short description', optional: true }, { key: 'imageUrl', label: 'Image URL (optional)', placeholder: 'https://...', optional: true }, { key: 'link', label: 'Link (optional)', placeholder: 'https://...', optional: true }] },
  { id: 'twitch',         name: 'Twitch',           desc: 'Followers + current stream',                     color: '#9146FF', fields: [{ key: 'username', label: 'Channel', placeholder: 'ninja' }] },
  { id: 'youtube',        name: 'YouTube',          desc: 'Channel + latest video',                         color: '#FF0000', fields: [{ key: 'channelId', label: 'Channel ID (UC...)', placeholder: 'UCxxxxxxxxxxxx' }] },
  { id: 'statsfm',        name: 'stats.fm',         desc: 'Now playing + recent tracks',                    color: '#1ED760', fields: [{ key: 'username', label: 'Username', placeholder: 'yourname' }] },
  { id: 'pinterest',      name: 'Pinterest',        desc: 'Recent pins from your boards',                   color: '#E60023', fields: [{ key: 'username', label: 'Username', placeholder: 'yourname' }] },
  { id: 'twitter',        name: 'Twitter / X',      desc: 'Profile card linking to your X',                 color: '#1D9BF0', fields: [{ key: 'username', label: 'Username', placeholder: 'yourhandle' }] },
  { id: 'telegram',       name: 'Telegram',         desc: 'Profile card linking to Telegram',               color: '#229ED9', fields: [{ key: 'username', label: 'Username', placeholder: 'yourhandle' }] },
] as const

const DISPLAY_MODES = [
  { value: 'grid',     label: 'Grid',     desc: 'Side by side grid',       icon: IconLayoutGrid },
  { value: 'stack',    label: 'Stack',    desc: 'Single column stack',     icon: IconAlignJustified },
  { value: 'carousel', label: 'Carousel', desc: 'Auto-rotating carousel',  icon: IconCarouselHorizontal },
] as const

const MULTI_TYPES = ['custom', 'time']

// haunt-style card shell: generously rounded, hairline ring, header with a
// title/description on the left and an action slot on the right.
function SectionCard({
  title, description, action, children,
}: {
  title: string
  description: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm ring-1 ring-white/[0.02]">
      <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-6 sm:pt-6">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">{children}</div>
    </div>
  )
}

export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedType, setSelectedType] = useState<string>('')
  const [newConfig, setNewConfig] = useState<Record<string, string>>({ accentColor: '#e87fa0' })
  const [displayMode, setDisplayMode] = useState<string>('carousel')
  const [pickerOpen, setPickerOpen] = useState(false)
  // Tracks any Discord widget the user has configured whose Discord
  // user_id isn't being tracked by the bot (= user isn't in halo.rip's
  // Discord server). When non-null, the banner at the top of the page
  // renders, nudging them to join. Null = no Discord widget, or it
  // is tracked.
  const [discordUntrackedId, setDiscordUntrackedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/widgets')
      .then(r => r.json())
      .then(d => setWidgets(d.widgets || []))
      .finally(() => setLoading(false))
    // Load current display mode from profile
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d?.profile?.widget_display_mode) {
          setDisplayMode(d.profile.widget_display_mode)
        }
      })
      .catch(() => {})
  }, [])

  // Whenever the widget list changes, look for a Discord widget and
  // probe /api/discord-presence/[userId] to see if the bot is tracking
  // it. A 404 means the user isn't in halo.rip's Discord server, in
  // which case we surface the banner. We only check the first Discord
  // widget - users can only have one of each type anyway.
  useEffect(() => {
    const discord = widgets.find((w) => w.type === 'discord' && w.enabled)
    const discordId = String(discord?.config?.userId ?? '').trim()
    if (!discord || !/^\d{17,20}$/.test(discordId)) {
      setDiscordUntrackedId(null)
      return
    }
    let cancelled = false
    fetch(`/api/discord-presence/${discordId}`)
      .then((r) => {
        if (cancelled) return
        if (r.status === 404) setDiscordUntrackedId(discordId)
        else setDiscordUntrackedId(null)
      })
      .catch(() => {
        // Network error - don't show a misleading banner.
        if (!cancelled) setDiscordUntrackedId(null)
      })
    return () => { cancelled = true }
  }, [widgets])

  const changeDisplayMode = async (value: string) => {
    setDisplayMode(value)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widget_display_mode: value }),
      })
      if (res.ok) {
        toast.success('Display style saved')
      } else {
        toast.error('Failed to save display style')
      }
    } catch {
      toast.error('Failed to save display style')
    }
  }

  const typeDef = WIDGET_TYPES.find(t => t.id === selectedType)

  const openPicker = () => {
    setSelectedType('')
    setNewConfig({ accentColor: '#e87fa0' })
    setPickerOpen(true)
  }

  const addWidget = async () => {
    if (!selectedType || !typeDef) return
    if (!MULTI_TYPES.includes(selectedType) && widgets.some(w => w.type === selectedType)) {
      toast.error(`You already have a ${typeDef.name} widget`)
      return
    }
    const missing = typeDef.fields.find(f => !(f as any).optional && !newConfig[f.key])
    if (missing) {
      toast.error(`Please fill ${missing.label}`)
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType, config: newConfig, display_order: widgets.length }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add widget')
      setWidgets(w => [...w, data.widget])
      setSelectedType('')
      setNewConfig({ accentColor: '#e87fa0' })
      setPickerOpen(false)
      toast.success('Widget added')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteWidget = async (id: string) => {
    const res = await fetch('/api/widgets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setWidgets(w => w.filter(x => x.id !== id))
      toast.success('Widget removed')
    }
  }

  const toggleWidget = async (id: string, enabled: boolean) => {
    const res = await fetch('/api/widgets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    })
    if (res.ok) {
      setWidgets(w => w.map(x => x.id === id ? { ...x, enabled } : x))
    }
  }

  const reorderWidget = async (srcId: string, dstId: string) => {
    if (srcId === dstId) return
    const sorted = [...widgets].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    const fromIdx = sorted.findIndex(x => x.id === srcId)
    const toIdx = sorted.findIndex(x => x.id === dstId)
    if (fromIdx < 0 || toIdx < 0) return
    const moved = sorted.splice(fromIdx, 1)[0]
    sorted.splice(toIdx, 0, moved)
    const next = sorted.map((w, i) => ({ ...w, display_order: i }))
    setWidgets(next)
    await Promise.all(next.map(w =>
      fetch('/api/widgets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id, display_order: w.display_order }) })
    ))
  }

  const moveWidget = async (id: string, dir: 'up' | 'down') => {
    const sorted = [...widgets].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    const idx = sorted.findIndex(x => x.id === id)
    if (idx < 0) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const a = sorted[idx]
    const b = sorted[swapIdx]
    const aOrder = a.display_order ?? idx
    const bOrder = b.display_order ?? swapIdx
    setWidgets(prev => prev.map(w => w.id === a.id ? { ...w, display_order: bOrder } : w.id === b.id ? { ...w, display_order: aOrder } : w))
    await Promise.all([
      fetch('/api/widgets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, display_order: bOrder }) }),
      fetch('/api/widgets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, display_order: aOrder }) }),
    ])
  }

  const addWidgetButton = (
    <Button onClick={openPicker} size="sm" className="rounded-full">
      <IconPlus className="size-4" />
      Add widget
    </Button>
  )

  return (
    <div className="space-y-5">
      {/* Discord widget nag banner. Renders only when the user has a
          Discord widget configured AND the bot can't see their
          presence yet (= they're not in halo.rip's Discord server). */}
      {discordUntrackedId && (
        <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] to-amber-500/[0.02] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
              <IconInfoCircle className="size-5 text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                Your Discord widget isn&apos;t working
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground-secondary">
                halo.rip tracks Discord status through our own bot inside the halo.rip Discord server. You&apos;re not in the server yet, so your widget can&apos;t show your live status. Join in 5 seconds to fix it.
              </p>
            </div>
            <a
              href="https://discord.gg/NgVh45gXbD"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/25"
            >
              Join discord.gg/NgVh45gXbD
              <IconExternalLink className="size-3.5 opacity-70" />
            </a>
          </div>
        </div>
      )}

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Profile Widgets</h1>
        <p className="text-sm text-muted-foreground">
          Show live data from your other accounts on your profile.
        </p>
      </header>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-accent-soft px-4 py-3 text-sm">
        <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="font-medium text-foreground">Enabled widgets show on your profile</p>
          <p className="text-muted-foreground">
            Add a widget below, then toggle it on. Pick how they&apos;re arranged with the display style.
          </p>
        </div>
      </div>

      {/* Widget Display Style */}
      <SectionCard
        title="Widget Display Style"
        description="Choose how widgets appear on your profile."
      >
        <div className="flex flex-wrap gap-2">
          {DISPLAY_MODES.map(({ value, label, desc, icon: Icon }) => {
            const active = displayMode === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => changeDisplayMode(value)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${active ? 'border-primary/60 bg-accent-soft text-foreground' : 'border-border bg-surface-2 text-foreground-secondary hover:border-border-strong hover:bg-surface-3 hover:text-foreground'}`}
              >
                <Icon className="size-4 shrink-0" />
                <span>{label}</span>
                <span className={`hidden text-xs sm:inline ${active ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>{desc}</span>
              </button>
            )
          })}
        </div>
      </SectionCard>

      {/* Your Widgets */}
      <SectionCard
        title={`Your widgets (${widgets.length}/10)`}
        description="Drag to reorder. Disabled widgets won't appear on your profile."
        action={addWidgetButton}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border bg-surface-2/40 px-6 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-3 text-muted-foreground">
              <IconLayoutGrid className="size-6" />
            </div>
            <p className="text-sm font-medium text-foreground">No widgets yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">Use Add widget above to place one on your profile.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {widgets.map((w) => {
              const def = WIDGET_TYPES.find(t => t.id === w.type)
              const color = def?.color || '#ffffff'
              const identifier = Object.entries(w.config || {})
                .filter(([k]) => k !== 'accentColor')
                .map(([, v]) => v)
                .filter(Boolean)
                .join(' · ')
              return (
                <li
                  key={w.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', w.id); e.dataTransfer.effectAllowed = 'move' }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                  onDrop={(e) => { e.preventDefault(); const srcId = e.dataTransfer.getData('text/plain'); if (srcId) reorderWidget(srcId, w.id) }}
                  className="flex flex-row items-center rounded-3xl border border-border bg-surface-2 p-1"
                >
                  <span className="grid cursor-grab place-content-center px-1 py-2 text-muted-foreground/60 transition-colors hover:text-foreground active:cursor-grabbing" aria-label="Drag to reorder">
                    <IconGripVertical className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl bg-surface">
                    <div className="flex min-w-0 items-center justify-between gap-2 p-2">
                      <div className="flex min-w-0 flex-1 items-center gap-3 ps-1">
                        <div
                          className="grid size-9 shrink-0 place-items-center rounded-xl border"
                          style={{
                            color,
                            borderColor: `${color}30`,
                            background: `linear-gradient(135deg, ${color}22, ${color}06)`,
                          }}
                        >
                          <BrandIcon id={w.type} className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">{def?.name || w.type}</div>
                          {identifier ? <div className="truncate text-xs text-muted-foreground">{identifier}</div> : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <div className="mr-0.5 flex flex-col gap-0.5">
                          <button onClick={() => moveWidget(w.id, 'up')} className="flex size-5 items-center justify-center rounded text-muted-foreground/70 hover:bg-white/[0.06] hover:text-foreground-secondary" title="Move up">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>
                          </button>
                          <button onClick={() => moveWidget(w.id, 'down')} className="flex size-5 items-center justify-center rounded text-muted-foreground/70 hover:bg-white/[0.06] hover:text-foreground-secondary" title="Move down">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
                          </button>
                        </div>
                        <Switch checked={w.enabled} onCheckedChange={(c) => toggleWidget(w.id, c)} />
                        <Button variant="ghost" size="icon" onClick={() => deleteWidget(w.id)} className="size-8 text-destructive hover:bg-destructive/10">
                          <IconTrash className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>

      {/* Pick a widget modal */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className={`sm:max-w-lg ${selectedType === 'time' ? 'overflow-y-visible' : 'max-h-[85vh] overflow-y-auto'}`}>
          <DialogHeader>
            <DialogTitle>Pick a widget</DialogTitle>
            <DialogDescription>Choose a platform, fill in the details, then add it to your profile.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Platform</label>
              <Select
                value={selectedType}
                onValueChange={(v) => { setSelectedType(v); setNewConfig({ accentColor: '#e87fa0' }) }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a platform" />
                </SelectTrigger>
                <SelectContent>
                  {WIDGET_TYPES.map((t) => {
                    const already = !MULTI_TYPES.includes(t.id) && widgets.some(w => w.type === t.id)
                    return (
                      <SelectItem key={t.id} value={t.id} disabled={already}>
                        <span className="flex items-center gap-2">
                          <span style={{ color: t.color }}><BrandIcon id={t.id} className="size-4" /></span>
                          <span>{t.name}</span>
                          {already ? <span className="text-xs text-muted-foreground">· added</span> : null}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {typeDef && (
              <>
                {/* Discord Presence setup tutorial */}
                {selectedType === 'discord' && (
                  <div className="space-y-4 rounded-2xl border border-[#5865F2]/20 bg-[#5865F2]/5 p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#5865F2]/20">
                        <IconInfoCircle className="size-4 text-[#5865F2]" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">How to set up Discord Presence</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5865F2]/30 text-[10px] font-bold text-[#5865F2]">1</div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-foreground">Join the halo.rip Discord server</p>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            We track your presence only while you&apos;re a member of halo.rip&apos;s server.
                          </p>
                          <a
                            href="https://discord.gg/NgVh45gXbD"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#5865F2] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
                          >
                            Join discord.gg/NgVh45gXbD
                            <IconExternalLink className="size-3 opacity-70" />
                          </a>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5865F2]/30 text-[10px] font-bold text-[#5865F2]">2</div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-foreground">Find your Discord User ID</p>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            In Discord, go to <span className="text-foreground-secondary">Settings → Advanced</span> and turn on <span className="text-foreground-secondary">Developer Mode</span>. Then right-click your profile picture and click <span className="text-foreground-secondary">Copy User ID</span>.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedType === 'time' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground-secondary">Timezone</label>
                    <TimezoneCombobox
                      value={newConfig.timezone || ''}
                      onChange={(v) => setNewConfig(c => ({ ...c, timezone: v }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Pick an IANA timezone (e.g. America/Denver). The city label is taken from the last part of the timezone.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {typeDef.fields.map(f => (
                      <div key={f.key} className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground-secondary">{f.label}</label>
                        <Input
                          value={newConfig[f.key] || ''}
                          onChange={(e) => setNewConfig(c => ({ ...c, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="h-10"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground-secondary">Widget color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newConfig.accentColor || '#e87fa0'}
                      onChange={(e) => setNewConfig({ ...newConfig, accentColor: e.target.value })}
                      className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                    />
                    <input
                      type="text"
                      value={newConfig.accentColor || '#e87fa0'}
                      onChange={(e) => setNewConfig({ ...newConfig, accentColor: e.target.value })}
                      placeholder="#e87fa0"
                      className="h-10 flex-1 rounded-lg border border-border bg-surface-2 px-3 font-mono text-sm text-foreground"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>Cancel</Button>
            <Button onClick={addWidget} disabled={saving || !selectedType} className="rounded-full">
              {saving ? <IconLoader2 className="mr-1 size-4 animate-spin" /> : <IconPlus className="mr-1 size-4" />}
              Add widget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
