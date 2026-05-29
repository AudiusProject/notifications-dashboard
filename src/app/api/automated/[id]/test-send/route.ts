import { NextRequest, NextResponse } from 'next/server'

import { getSessionFromRequest } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { AutomatedTrigger } from '@/lib/supabase/types'

type Context = { params: Promise<{ id: string }> }

const SEND_BATCH_SIZE = 500

type TriggerConfig = Pick<
  AutomatedTrigger,
  'id' | 'name' | 'trigger_hours' | 'heading' | 'body' | 'image_url' | 'cta_link'
>

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
 * POST /api/automated/[id]/test-send
 *
 * Sends this trigger's current notification copy to a specific list of user
 * IDs. Bypasses the inactive-users query entirely — useful for previewing copy
 * on a real device before it goes live to the full audience.
 *
 * Does NOT write to trigger_sends so test sends don't affect metrics.
 *
 * Auth: session cookie (same as the rest of the dashboard UI).
 *
 * Body: { userIds: number[] }  (max 100)
 */
export async function POST(request: NextRequest, { params }: Context) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const baseUrl = process.env.NOTIFICATIONS_SERVICE_URL
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'NOTIFICATIONS_SERVICE_URL not configured' },
      { status: 503 }
    )
  }

  let body: { userIds?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { userIds } = body

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json(
      { error: 'userIds must be a non-empty array' },
      { status: 400 }
    )
  }
  if (userIds.length > 100) {
    return NextResponse.json(
      { error: 'Maximum 100 user IDs per test send' },
      { status: 400 }
    )
  }
  if (!userIds.every((u) => typeof u === 'number' && Number.isInteger(u))) {
    return NextResponse.json(
      { error: 'All userIds must be integers' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseAdmin()
  const { data: trigger } = await supabase
    .from('automated_triggers')
    .select('id, name, trigger_hours, heading, body, image_url, cta_link')
    .eq('id', id)
    .single<TriggerConfig>()

  if (!trigger) {
    return NextResponse.json({ error: 'Trigger not found' }, { status: 404 })
  }

  const sendSecret = process.env.ANNOUNCEMENT_SEND_SECRET

  try {
    const sent = await sendTrigger(baseUrl, sendSecret, trigger, userIds as number[])
    return NextResponse.json({ ok: true, sent, trigger_name: trigger.name })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Send failed' },
      { status: 500 }
    )
  }
}
