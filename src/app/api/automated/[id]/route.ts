import { NextRequest, NextResponse } from 'next/server'
import { displayNameFromSession, getSessionFromRequest } from '@/lib/auth'
import {
  NOTIFICATION_BODY_MAX_LENGTH,
  NOTIFICATION_HEADING_MAX_LENGTH,
} from '@/lib/notificationCopyLimits'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { AutomatedTrigger, TriggerPerformance } from '@/lib/supabase/types'
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

  const [{ data: trigger }, { data: performance }] = await Promise.all([
    supabase.from('automated_triggers').select('*').eq('id', id).single<AutomatedTrigger>(),
    supabase
      .from('trigger_performance')
      .select('*')
      .eq('trigger_id', id)
      .order('created_at', { ascending: true })
      .returns<TriggerPerformance[]>(),
  ])

  if (!trigger)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ...trigger, performance })
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const unauth = await requireSession(request)
  if (unauth) return unauth
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const updates = await request.json()

  const allowed = ['heading', 'body', 'image_url', 'cta_link', 'is_active']
  const filtered: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in updates) filtered[key] = updates[key]
  }

  if (typeof filtered.heading === 'string') {
    if (filtered.heading.length > NOTIFICATION_HEADING_MAX_LENGTH) {
      return NextResponse.json(
        {
          error: `Heading must be at most ${NOTIFICATION_HEADING_MAX_LENGTH} characters`,
        },
        { status: 400 }
      )
    }
  }
  if (typeof filtered.body === 'string') {
    if (filtered.body.length > NOTIFICATION_BODY_MAX_LENGTH) {
      return NextResponse.json(
        {
          error: `Body must be at most ${NOTIFICATION_BODY_MAX_LENGTH} characters`,
        },
        { status: 400 }
      )
    }
  }

  filtered.updated_at = new Date().toISOString()
  filtered.last_updated_by = displayNameFromSession(session)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('automated_triggers')
    .update(filtered)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
