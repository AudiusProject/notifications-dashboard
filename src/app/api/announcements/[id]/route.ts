import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Announcement } from '@/lib/supabase/types'
import { DashboardAnalyticsEvents } from '@/lib/analytics/events'
import { scheduleDashboardAnalytics } from '@/lib/analytics/track'

type Context = { params: Promise<{ id: string }> }

async function requireSession(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return null
}

export async function GET(request: NextRequest, { params }: Context) {
  const unauth = await requireSession(request)
  if (unauth) return unauth
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('id', id)
    .single<Announcement>()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const updates = await request.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('announcements')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const updatedFields = Object.keys(updates).filter((k) => k !== 'updated_at')
  scheduleDashboardAnalytics(session.email, DashboardAnalyticsEvents.ANNOUNCEMENT_UPDATED, {
    notificationCampaignId: id,
    updated_fields: updatedFields.slice(0, 40),
    updated_field_count: updatedFields.length,
  })

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = getSupabaseAdmin()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('announcements').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  scheduleDashboardAnalytics(session.email, DashboardAnalyticsEvents.ANNOUNCEMENT_DELETED, {
    notificationCampaignId: id,
  })

  return NextResponse.json({ ok: true })
}
