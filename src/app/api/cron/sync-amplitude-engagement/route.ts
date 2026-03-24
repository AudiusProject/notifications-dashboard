import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  syncAnnouncementEngagementById,
  type AnnouncementRow,
} from '@/lib/amplitude/syncAnnouncementEngagement'

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
 * Vercel Cron: syncs engagement for sent announcements into Supabase.
 * Push opens: Discovery (`AUDIUS_API_URL` + `NOTIFICATION_CAMPAIGN_OPEN_METRICS_SECRET`) when set;
 * otherwise Amplitude. Tile/CTA: Amplitude when keys are set.
 *
 * Requires `CRON_SECRET`, Supabase admin, and either Discovery open metrics and/or Amplitude keys.
 */
export async function GET(request: Request) {
  const authError = verifyCron(request)
  if (authError) return authError

  const hasAmplitude =
    Boolean(process.env.AMPLITUDE_API_KEY?.trim()) &&
    Boolean(process.env.AMPLITUDE_SECRET_KEY?.trim())
  const hasDiscoveryOpens =
    Boolean(process.env.AUDIUS_API_URL?.trim()) &&
    Boolean(process.env.NOTIFICATION_CAMPAIGN_OPEN_METRICS_SECRET?.trim())

  if (!hasAmplitude && !hasDiscoveryOpens) {
    return NextResponse.json(
      {
        error:
          'Metrics sync not configured: set AUDIUS_API_URL + NOTIFICATION_CAMPAIGN_OPEN_METRICS_SECRET and/or AMPLITUDE_API_KEY + AMPLITUDE_SECRET_KEY',
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
  const results: Array<{ id: string; ok: boolean; error?: string }> = []

  for (let i = 0; i < announcements.length; i++) {
    const row = announcements[i]
    if (!row.sent_at) {
      results.push({ id: row.id, ok: false, error: 'missing sent_at' })
      continue
    }
    const result = await syncAnnouncementEngagementById(row.id)
    if (result.ok) {
      results.push({ id: row.id, ok: true })
    } else {
      results.push({ id: row.id, ok: false, error: result.error })
    }
    if (i < announcements.length - 1) {
      await new Promise((r) => setTimeout(r, 120))
    }
  }

  const okCount = results.filter((r) => r.ok).length
  return NextResponse.json({
    ok: true,
    processed: announcements.length,
    updated: okCount,
    results,
  })
}
