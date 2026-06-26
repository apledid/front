import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    // Rate limit: 10 reports per hour per IP
    const rateLimit = await withRateLimit(request, 'report')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) {
      return NextResponse.json({ error: 'Please log in to report content' }, { status: 401 })
    }

    const body = await request.json()
    const { reportedUserId, reportType, description } = body

    if (!reportedUserId || !reportType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const validTypes = ['illegal_content', 'harassment', 'spam', 'impersonation', 'other']
    if (!validTypes.includes(reportType)) {
      return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    // Can't report yourself
    if (reportedUserId === profile.id) {
      return NextResponse.json({ error: 'You cannot report yourself' }, { status: 400 })
    }

    const ip = getClientIp(request)

    const admin = createAdminClient()

    // Verify the reported user actually exists. Without this, an attacker
    // can spam random UUIDs to fill `content_reports` with garbage.
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('id', reportedUserId)
      .maybeSingle()
    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user already reported this person recently (prevent spam)
    const { data: existingReport } = await admin
      .from('content_reports')
      .select('id')
      .eq('reporter_id', profile.id)
      .eq('reported_user_id', reportedUserId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle()

    if (existingReport) {
      return NextResponse.json({ 
        error: 'You have already reported this user in the last 24 hours' 
      }, { status: 400 })
    }

    // Create the report
    const { error } = await admin.from('content_reports').insert({
      reporter_id: profile.id,
      reported_user_id: reportedUserId,
      report_type: reportType,
      description: description?.substring(0, 1000) || null, // Limit description length
      ip_address: ip,
    })

    if (error) {
      console.error('[report] Failed to create report:', error)
      return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
    }

    // If this is an illegal_content report, flag the user for admin review.
    // No auto-ban - the flag just puts them in the admin review queue.
    //
    // Anti-abuse: require both distinct REPORTERS and distinct IPs to
    // reach the threshold. Previously a raw count of 3 was enough, so
    // an attacker who could spin up 3 throwaway accounts (within the
    // signup rate limit of 3/hour/IP) could permanently flag any user.
    // Requiring distinct IPs as well means the same mass-flagger has
    // to ALSO rotate IPs/VPNs - much higher cost per flag.
    if (reportType === 'illegal_content') {
      const { data: priorReports } = await admin
        .from('content_reports')
        .select('reporter_id, ip_address')
        .eq('reported_user_id', reportedUserId)
        .eq('report_type', 'illegal_content')

      const rows = priorReports ?? []
      const distinctReporters = new Set(
        rows.map((r: any) => r.reporter_id).filter((v: unknown) => typeof v === 'string'),
      )
      const distinctIps = new Set(
        rows.map((r: any) => r.ip_address).filter((v: unknown) => typeof v === 'string' && v.length > 0),
      )

      if (distinctReporters.size >= 3 && distinctIps.size >= 3) {
        await admin
          .from('profiles')
          .update({ flagged_for_review: true })
          .eq('id', reportedUserId)
      }
    }

    return NextResponse.json({ success: true, message: 'Report submitted successfully' })
  } catch (error) {
    console.error('[report] Report error:', error)
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
  }
}
