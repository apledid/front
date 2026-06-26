// Discord webhook for sending log notifications from the website to Discord
// Set DISCORD_WEBHOOK_URL in your environment variables

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL

const BRAND_COLOR = 0xe87fa0
const SUCCESS_COLOR = 0x34d399
const ERROR_COLOR = 0xf87171
const WARN_COLOR = 0xfbbf24

interface WebhookEmbed {
  title: string
  description: string
  color: number
  timestamp?: string
  footer?: { text: string }
  fields?: { name: string; value: string; inline?: boolean }[]
}

async function sendWebhook(embeds: WebhookEmbed[]) {
  if (!WEBHOOK_URL) return

  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'halo.rip',
        // Defence-in-depth: every caller of this helper currently
        // passes pre-validated input (usernames matching ^[a-z0-9_]+$,
        // numeric counts, etc.), but Discord webhooks honour
        // @everyone / @here / role pings in any embed value field by
        // default. Bolt parse:[] on at this layer so the next caller
        // that interpolates user-controllable text into a description
        // can't reopen the staff-channel-ping hole. Same flag added
        // to the /api/templates/report payload directly.
        allowed_mentions: { parse: [] as string[] },
        embeds: embeds.map(e => ({
          ...e,
          timestamp: e.timestamp || new Date().toISOString(),
          footer: e.footer || { text: 'halo.rip' },
        })),
      }),
    })
  } catch (err) {
    console.error('[Discord Webhook] Failed:', err)
  }
}

export async function logNewSignup(username: string, email?: string) {
  await sendWebhook([{
    title: 'New Signup',
    description: `**${username}** created an account`,
    color: SUCCESS_COLOR,
    fields: [
      { name: 'Email', value: email ? '(verified)' : '(none)', inline: true },
    ],
  }])
}

export async function logUserBanned(username: string, reason: string, bannedBy: string) {
  await sendWebhook([{
    title: 'User Banned',
    description: `**${username}** was banned`,
    color: WARN_COLOR,
    fields: [
      { name: 'Reason', value: reason, inline: true },
      { name: 'By', value: bannedBy, inline: true },
    ],
  }])
}

export async function logLogin(username: string) {
  await sendWebhook([{
    title: 'User Login',
    description: `**${username}** logged in`,
    color: BRAND_COLOR,
  }])
}

export async function logAccountDeleted(username: string) {
  await sendWebhook([{
    title: 'Account Deleted',
    description: `**${username}** deleted their account`,
    color: ERROR_COLOR,
  }])
}

export async function logPremiumActivated(username: string) {
  await sendWebhook([{
    title: 'Premium Activated',
    description: `**${username}** is now premium`,
    color: BRAND_COLOR,
    fields: [{ name: 'Status', value: 'Active', inline: true }],
  }])
}
