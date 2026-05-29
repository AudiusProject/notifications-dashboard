import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { AutomatedTrigger } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
/** Vercel Pro+: raise if many triggers / large audiences need more time. */
export const maxDuration = 120

const SEND_BATCH_SIZE = 500
/**
 * Inactivity band width (hours). MUST match this cron's schedule in vercel.json
 * so each user is caught exactly once per inactivity episode as they cross the
 * threshold. Cron runs hourly → window = 1.
 */
const WINDOW_HOURS = 1

type TriggerConfig = Pick<
  AutomatedTrigger,
  'id' | 'name' | 'trigger_hours' | 'heading' | 'body' | 'image_url' | 'cta_link'
>

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

async function fetchInactiveUserIds(
  baseUrl: string,
  secret: string | undefined,
  triggerHours: number
): Promise<number[]> {
  const url = `${baseUrl}/internal/inactive-users?hours=${triggerHours}&windowHours=${WINDOW_HOURS}`
  const res = await fetch(url, {
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`inactive-users returned ${res.status}: ${text}`)
  }
  const data = await res.json()
  return Array.isArray(data.userIds) ? data.userIds : []
}

async function sendTrigger(
  baseUrl: string,
  secret: string | undefined,
  trigger: TriggerConfig,
  userIds: number[]
): Promise<number> {
  let sent = 0
  for (let i = 0; i < userIds.length; i += SEND_BATCH_SIZE) {
    const batch = userIds.slice(i, i + SEND_BATCH_SIZE)
    const res = await fetch(`${baseUrl}/internal/send-announcement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      // notification_campaign_id = trigger id, so push opens attribute back to
      // this automated trigger (same mechanism as one-off announcements).
      body: JSON.stringify({
        title: trigger.heading,
        body: trigger.body,
        image_url: trigger.image_url ?? undefined,
        route: trigger.cta_link ?? undefined,
        notification_campaign_id: trigger.id,
        userIds: batch,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`send-announcement returned ${res.status}: ${text}`)
    }
    const result = await res.json()
    sent += result.sent ?? batch.length
  }
  return sent
}

/**
 * Vercel Cron: re-engagement push for inactive users. For each active automated
 * trigger, asks the notification service for users who just crossed the trigger's
 * inactivity threshold, then sends via the existing send-announcement pipeline.
 * Requires `CRON_SECRET`, `NOTIFICATIONS_SERVICE_URL`, and `ANNOUNCEMENT_SEND_SECRET`.
 */
export async function GET(request: Request) {
  const authError = verifyCron(request)
  if (authError) return authError

  const baseUrl = process.env.NOTIFICATIONS_SERVICE_URL
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'NOTIFICATIONS_SERVICE_URL not configured' },
      { status: 503 }
    )
  }
  const sendSecret = process.env.ANNOUNCEMENT_SEND_SECRET

  const supabase = getSupabaseAdmin()
  const { data: rows, error } = await supabase
    .from('automated_triggers')
    .select('id, name, trigger_hours, heading, body, image_url, cta_link')
    .eq('is_active', true)
    .gt('trigger_hours', 0)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const triggers = (rows ?? []) as TriggerConfig[]
  const results: Array<{
    id: string
    name: string
    candidates: number
    sent: number
    error?: string
  }> = []

  for (const trigger of triggers) {
    try {
      const userIds = await fetchInactiveUserIds(
        baseUrl,
        sendSecret,
        trigger.trigger_hours
      )
      const sent =
        userIds.length > 0
          ? await sendTrigger(baseUrl, sendSecret, trigger, userIds)
          : 0

      // Log send count to trigger_sends for audience_reached_30d tracking.
      if (sent > 0) {
        await supabase.from('trigger_sends').insert({
          trigger_id: trigger.id,
          sent_at: new Date().toISOString(),
          user_count: sent,
        })
      }
      results.push({
        id: trigger.id,
        name: trigger.name,
        candidates: userIds.length,
        sent,
      })
    } catch (err) {
      results.push({
        id: trigger.id,
        name: trigger.name,
        candidates: 0,
        sent: 0,
        error: err instanceof Error ? err.message : 'failed',
      })
    }
  }

  return NextResponse.json({
    ok: true,
    triggers: triggers.length,
    results,
  })
}
