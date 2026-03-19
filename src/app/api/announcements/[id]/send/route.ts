import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Announcement } from '@/lib/supabase/types'

type Context = { params: Promise<{ id: string }> }

const SEND_BATCH_SIZE = 500

export async function POST(request: NextRequest, { params }: Context) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = getSupabaseAdmin()

  const { data: announcement } = await supabase
    .from('announcements')
    .select('*')
    .eq('id', id)
    .single<Announcement>()

  if (!announcement) {
    return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
  }

  if (announcement.status !== 'ready') {
    return NextResponse.json(
      { error: `Cannot send: status is ${announcement.status}` },
      { status: 400 }
    )
  }

  const { data: recipients } = await (supabase as any)
    .from('announcement_recipients')
    .select('user_id')
    .eq('announcement_id', id)

  const userIds: number[] = (recipients ?? []).map((r: { user_id: number }) => r.user_id)

  if (userIds.length === 0) {
    return NextResponse.json(
      { error: 'No recipients. Upload a CSV with user IDs and save as Ready first.' },
      { status: 400 }
    )
  }

  const baseUrl = process.env.NOTIFICATIONS_SERVICE_URL
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'NOTIFICATIONS_SERVICE_URL not configured' },
      { status: 500 }
    )
  }

  await (supabase as any)
    .from('announcements')
    .update({
      status: 'sending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  let sentCount = 0
  let failed = false

  try {
    for (let i = 0; i < userIds.length; i += SEND_BATCH_SIZE) {
      const batch = userIds.slice(i, i + SEND_BATCH_SIZE)
      const res = await fetch(`${baseUrl}/internal/send-announcement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.ANNOUNCEMENT_SEND_SECRET
            ? {
                Authorization: `Bearer ${process.env.ANNOUNCEMENT_SEND_SECRET}`,
              }
            : {}),
        },
        body: JSON.stringify({
          title: announcement.heading,
          body: announcement.body,
          image_url: announcement.image_url ?? undefined,
          route: announcement.cta_link ?? undefined,
          userIds: batch,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Pedalboard returned ${res.status}: ${text}`)
      }

      const result = await res.json()
      sentCount += result.sent ?? batch.length
    }

    await (supabase as any)
      .from('announcements')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        recipients_reached: sentCount,
        funnel_sent: userIds.length,
        funnel_delivered: sentCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
  } catch (err) {
    failed = true
    await (supabase as any)
      .from('announcements')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    console.error('Send announcement failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Send failed' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    sent: sentCount,
    total: userIds.length,
  })
}
