import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  sendgridWebhookConfigured,
  verifySendgridSignature,
} from '@/lib/sendgrid/verifyWebhookSignature'

/**
 * SendGrid Event Webhook receiver.
 *
 * Ingests per-event records (processed/delivered/open/click/bounce/…) into
 * `email_events`, deduped on `sg_event_id`. Aggregation into
 * `announcements.email_*` is done by the hourly cron (`sync-engagement`),
 * not here — keeps this endpoint fast + idempotent under SendGrid retries.
 *
 * SendGrid is configured in its dashboard to POST here with signature headers;
 * set `SENDGRID_WEBHOOK_PUBLIC_KEY` (base64 SPKI DER) before enabling.
 *
 * Events without `announcement_id` in custom_args are logged with NULL
 * announcement_id so the row is still captured for debugging, but they won't
 * roll up into any announcement's funnel.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // need node:crypto

type SendgridEvent = {
  email?: string
  event?: string
  timestamp?: number
  sg_event_id?: string
  sg_message_id?: string
  url?: string
  useragent?: string
  ip?: string
  reason?: string
  // custom_args are flattened at the top level by SendGrid
  announcement_id?: string
  user_id?: string | number
  channel?: string
}

const ALLOWED_EVENT_TYPES = new Set([
  'processed',
  'delivered',
  'open',
  'click',
  'bounce',
  'dropped',
  'deferred',
  'spamreport',
  'unsubscribe',
  'group_unsubscribe',
  'group_resubscribe',
])

export async function POST(request: Request) {
  if (!sendgridWebhookConfigured()) {
    return NextResponse.json(
      { error: 'SENDGRID_WEBHOOK_PUBLIC_KEY not configured' },
      { status: 503 }
    )
  }

  const rawBody = await request.text()
  const verified = verifySendgridSignature(request.headers, rawBody)
  if (!verified.ok) {
    return NextResponse.json(
      { error: 'Unauthorized', reason: verified.reason },
      { status: 401 }
    )
  }

  let events: SendgridEvent[]
  try {
    const parsed = JSON.parse(rawBody) as unknown
    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { error: 'Expected JSON array' },
        { status: 400 }
      )
    }
    events = parsed as SendgridEvent[]
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rows = events
    .map((e) => toRow(e))
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, ingested: 0 })
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('email_events')
    .upsert(rows, { onConflict: 'sg_event_id', ignoreDuplicates: true })

  if (error) {
    // Return 500 so SendGrid retries. Payloads that permanently poison us
    // would still be dropped after SendGrid's retry budget.
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ingested: rows.length })
}

function toRow(e: SendgridEvent) {
  if (!e.sg_event_id || !e.event || !e.timestamp) return null
  if (!ALLOWED_EVENT_TYPES.has(e.event)) return null

  const announcementId =
    typeof e.announcement_id === 'string' &&
    /^[0-9a-f-]{36}$/i.test(e.announcement_id)
      ? e.announcement_id
      : null

  const userId =
    e.user_id == null ? null : String(e.user_id)

  return {
    sg_event_id: e.sg_event_id,
    announcement_id: announcementId,
    user_id: userId,
    event_type: e.event as
      | 'processed'
      | 'delivered'
      | 'open'
      | 'click'
      | 'bounce'
      | 'dropped'
      | 'deferred'
      | 'spamreport'
      | 'unsubscribe'
      | 'group_unsubscribe'
      | 'group_resubscribe',
    url: e.url ?? null,
    sg_message_id: e.sg_message_id ?? null,
    reason: e.reason ?? null,
    user_agent: e.useragent ?? null,
    ip: e.ip ?? null,
    ts: new Date(e.timestamp * 1000).toISOString(),
  }
}
