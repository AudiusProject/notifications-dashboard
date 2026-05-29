import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { AutomatedTrigger } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SEND_BATCH_SIZE = 500

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

async function sendTrigger(
  baseUrl: string,
  secret: string | undefined,
  trigger: TriggerConfig,
  userIds: number[]
): Promise<number> {
  let sent = 0
  for (let i = 0; i < userIds.length; i += SEND_BATCH_SIZE) {
    const batch = userIds.slice(i, i + SEND_BATCH_SIZE)
    const res = await fetch(`${baseUrl}/internal/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
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
      throw new Error(`send-notification returned ${res.status}: ${text}`)
    }
    const result = await res.json()
    sent += result.sent ?? batch.length
  }
  return sent
}

/**
 * Test endpoint: sends automated trigger notifications to a fixed list of user
 * IDs, bypassing the inactive-users query entirely. Useful for verifying copy
 * and delivery without waiting for real inactivity thresholds to fire.
 *
 * Does NOT write to trigger_sends — test sends don't count toward audience
 * metrics or open-rate denominators.
 *
 * Auth: same CRON_SECRET Bearer token as the live cron.
 *
 * POST body:
 *   userIds   number[]   Required. User IDs to send to (max 100).
 *   triggerIds string[]  Optional. Restrict to these trigger IDs. Omit to test
 *                        all active triggers.
 *
 * Example:
 *   curl -X POST https://<host>/api/cron/send-reengagement/test \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"userIds":[12345,67890],"triggerIds":["<uuid>"]}'
 */
export async function POST(request: Request) {
  const authError = verifyCron(request)
  if (authError) return authError

  const baseUrl = process.env.NOTIFICATIONS_SERVICE_URL
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'NOTIFICATIONS_SERVICE_URL not configured' },
      { status: 503 }
    )
  }

  let body: { userIds?: unknown; triggerIds?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { userIds, triggerIds: rawTriggerIds } = body

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json(
      { error: 'userIds must be a non-empty array of user IDs' },
      { status: 400 }
    )
  }
  if (userIds.length > 100) {
    return NextResponse.json(
      { error: 'userIds is capped at 100 for test sends' },
      { status: 400 }
    )
  }
  if (!userIds.every((id) => typeof id === 'number' && Number.isInteger(id))) {
    return NextResponse.json(
      { error: 'All userIds must be integers' },
      { status: 400 }
    )
  }

  const triggerIds = Array.isArray(rawTriggerIds)
    ? (rawTriggerIds as string[])
    : null

  const sendSecret = process.env.ANNOUNCEMENT_SEND_SECRET
  const supabase = getSupabaseAdmin()

  let query = supabase
    .from('automated_triggers')
    .select('id, name, trigger_hours, heading, body, image_url, cta_link')
    .eq('is_active', true)
    .gt('trigger_hours', 0)

  if (triggerIds) {
    query = query.in('id', triggerIds)
  }

  const { data: rows, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const triggers = (rows ?? []) as TriggerConfig[]

  if (triggers.length === 0) {
    return NextResponse.json(
      { error: 'No matching active triggers found' },
      { status: 404 }
    )
  }

  const results: Array<{
    id: string
    name: string
    sent: number
    error?: string
  }> = []

  for (const trigger of triggers) {
    try {
      const sent = await sendTrigger(
        baseUrl,
        sendSecret,
        trigger,
        userIds as number[]
      )
      results.push({ id: trigger.id, name: trigger.name, sent })
    } catch (err) {
      results.push({
        id: trigger.id,
        name: trigger.name,
        sent: 0,
        error: err instanceof Error ? err.message : 'failed',
      })
    }
  }

  return NextResponse.json({
    ok: true,
    test_user_ids: userIds,
    triggers_tested: triggers.length,
    results,
  })
}
