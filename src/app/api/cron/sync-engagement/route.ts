import { NextResponse } from 'next/server'

import {
  syncAnnouncementEngagementById,
  type AnnouncementRow,
} from '@/lib/engagement/syncAnnouncementEngagement'
import { syncEmailEngagementById } from '@/lib/engagement/syncEmailEngagement'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { notificationCampaignOpenMetricsConfigured } from '@/lib/discovery/notificationCampaignPushOpens'

export const dynamic = 'force-dynamic'
/** Vercel Pro+: raise if the job needs more time for many announcements. */
export const maxDuration = 120

const BATCH_LIMIT = 40

function verifyCron(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret?.trim()) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not set (required to run this cron securely)' },
      { status: 503 }
    )
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

/**
 * Vercel Cron: syncs push open metrics from Discovery into Supabase announcements.
 * Requires `CRON_SECRET`, Supabase admin, and `AUDIUS_API_URL` +
 * `NOTIFICATION_CAMPAIGN_OPEN_METRICS_SECRET`.
 */
export async function GET(request: Request) {
  const authError = verifyCron(request)
  if (authError) return authError

  if (!notificationCampaignOpenMetricsConfigured()) {
    return NextResponse.json(
      {
        error:
          'Metrics sync not configured: set AUDIUS_API_URL and NOTIFICATION_CAMPAIGN_OPEN_METRICS_SECRET',
      },
      { status: 503 }
    )
  }

  const supabase = getSupabaseAdmin()

  const { data: rows, error } = await supabase
    .from('announcements')
    .select('id, sent_at, funnel_sent')
    .eq('status', 'sent')
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(BATCH_LIMIT)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const announcements = (rows ?? []) as AnnouncementRow[]
  const results: Array<{
    id: string
    push: { ok: boolean; error?: string }
    email: { ok: boolean; error?: string }
  }> = []

  for (let i = 0; i < announcements.length; i++) {
    const row = announcements[i]
    if (!row.sent_at) {
      results.push({
        id: row.id,
        push: { ok: false, error: 'missing sent_at' },
        email: { ok: false, error: 'missing sent_at' },
      })
      continue
    }
    // Push opens (Discovery) and email aggregation (SendGrid events in
    // Supabase) are independent; run both. Email sync is local-DB only, so
    // it's cheap and doesn't need the inter-iteration sleep.
    const [pushResult, emailResult] = await Promise.all([
      syncAnnouncementEngagementById(row.id),
      syncEmailEngagementById(row.id),
    ])
    results.push({
      id: row.id,
      push: pushResult.ok
        ? { ok: true }
        : { ok: false, error: pushResult.error },
      email: emailResult.ok
        ? { ok: true }
        : { ok: false, error: emailResult.error },
    })
    if (i < announcements.length - 1) {
      await new Promise((r) => setTimeout(r, 120))
    }
  }

  const pushOk = results.filter((r) => r.push.ok).length
  const emailOk = results.filter((r) => r.email.ok).length
  return NextResponse.json({
    ok: true,
    processed: announcements.length,
    push_updated: pushOk,
    email_updated: emailOk,
    results,
  })
}
