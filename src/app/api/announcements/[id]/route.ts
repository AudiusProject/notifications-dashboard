import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import {
  NOTIFICATION_BODY_MAX_LENGTH,
  NOTIFICATION_HEADING_MAX_LENGTH,
} from '@/lib/notificationCopyLimits'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Announcement } from '@/lib/supabase/types'
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

  if (typeof updates.heading === 'string') {
    if (updates.heading.length > NOTIFICATION_HEADING_MAX_LENGTH) {
      return NextResponse.json(
        {
          error: `Heading must be at most ${NOTIFICATION_HEADING_MAX_LENGTH} characters`,
        },
        { status: 400 }
      )
    }
  }
  if (typeof updates.body === 'string') {
    if (updates.body.length > NOTIFICATION_BODY_MAX_LENGTH) {
      return NextResponse.json(
        {
          error: `Body must be at most ${NOTIFICATION_BODY_MAX_LENGTH} characters`,
        },
        { status: 400 }
      )
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('announcements')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

  return NextResponse.json({ ok: true })
}
