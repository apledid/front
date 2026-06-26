import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'

// User-submitted template reports. Inserts a row and fires a Discord
// webhook (DISCORD_REPORTS_WEBHOOK) if configured - staff can also act
// on reports from the admin panel.
export async function POST(request: Request) {
  try {
    const rl = await withRateLimit(request, 'report')
    if (rl.response) return rl.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    // Accept both `template_id` (current client) and `id` (legacy).
    // The client at app/dashboard/templates/page.tsx and the preview
    // overlay both send template_id, so the prior `id`-only read was
    // 100% broken - every report came back as "Template id required".
    const templateId: string | undefined = body?.template_id || body?.id
    const reason = body?.reason
    if (!templateId) return NextResponse.json({ error: 'Template id required' }, { status: 400 })
    const r = String(reason || '').trim()
    if (r.length < 4 || r.length > 500) {
      return NextResponse.json({ error: 'Reason must be 4-500 characters' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: tpl } = await admin
      .from('templates')
      .select('id, name, user_id, author:profiles!templates_user_id_fkey(username)')
      .eq('id', templateId)
      .single()
    if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    // One report per user per template. Each insert fires a staff Discord
    // webhook, so without this a single user could spam the staff channel
    // (up to the 10/hour rate limit). Mirrors /api/report's per-reporter dedupe.
    const { data: alreadyReported } = await admin
      .from('template_reports')
      .select('id')
      .eq('template_id', templateId)
      .eq('reporter_id', profile.id)
      .maybeSingle()
    if (alreadyReported) return NextResponse.json({ success: true })

    const { error } = await admin.from('template_reports').insert({
      template_id: templateId,
      reporter_id: profile.id,
      reason: r,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Fire Discord webhook (best-effort)
    const webhook = process.env.DISCORD_REPORTS_WEBHOOK
    if (webhook) {
      const authorName = (tpl.author as any)?.username || 'unknown'
      const siteBase = process.env.NEXT_PUBLIC_SITE_URL || 'https://halo.rip'
      const payload = {
        // allowed_mentions: { parse: [] } neuters @everyone /
        // @here / role mentions in the embed body. The `reason`
        // field is 4-500 chars of arbitrary user text - without
        // this any logged-in user could spam-ping the staff
        // channel by including @everyone in their report. Also
        // blocks the [text](url) markdown trick where the visible
        // text says "click for details" but the underlying link
        // is a phishing URL.
        allowed_mentions: { parse: [] as string[] },
        embeds: [{
          title: `🚨 Template Report: ${tpl.name.slice(0, 200)}`,
          color: 0xff4757,
          fields: [
            { name: 'Template', value: `${tpl.name.slice(0, 200)} (\`${tpl.id}\`)`, inline: false },
            { name: 'Author', value: authorName, inline: true },
            { name: 'Reporter', value: profile.username || profile.id, inline: true },
            // Clamp at 500 to match the route's body-validation
            // ceiling - the earlier 1000-char slice was stale.
            { name: 'Reason', value: r.slice(0, 500), inline: false },
            { name: 'Link', value: `${siteBase}/dashboard/admin/reports`, inline: false },
          ],
          timestamp: new Date().toISOString(),
        }],
      }
      fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => { /* best-effort */ })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })
  }
}
