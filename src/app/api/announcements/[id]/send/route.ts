import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Announcement } from '@/lib/supabase/types'
import { DashboardAnalyticsEvents } from '@/lib/analytics/events'
import { scheduleDashboardAnalytics, truncateForAnalytics } from '@/lib/analytics/track'

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
        // dashboard_announcement_id = Supabase announcements.id (push + Amplitude joins).
        body: JSON.stringify({
          title: announcement.heading,
          body: announcement.body,
          image_url: announcement.image_url ?? undefined,
          route: announcement.cta_link ?? undefined,
          dashboard_announcement_id: id,
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
    await (supabase as any)
      .from('announcements')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    const message = err instanceof Error ? err.message : 'Send failed'
    console.error('Send announcement failed:', err)

    scheduleDashboardAnalytics(
      session.email,
      DashboardAnalyticsEvents.ANNOUNCEMENT_SEND_FAILURE,
      {
        dashboardAnnouncementId: id,
        recipient_count: userIds.length,
        error_message: truncateForAnalytics(message),
      }
    )

    return NextResponse.json({ error: message }, { status: 500 })
  }

  scheduleDashboardAnalytics(session.email, DashboardAnalyticsEvents.ANNOUNCEMENT_SEND_SUCCESS, {
    dashboardAnnouncementId: id,
    recipient_count: userIds.length,
    sent_count: sentCount,
  })

  return NextResponse.json({
    ok: true,
    sent: sentCount,
    total: userIds.length,
  })
}
