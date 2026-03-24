import { NextRequest, NextResponse } from 'next/server'

import { getSessionFromRequest } from '@/lib/auth'
import { syncAnnouncementEngagementById } from '@/lib/amplitude/syncAnnouncementEngagement'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Announcement } from '@/lib/supabase/types'

type Context = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Manual refresh: same engagement sync as the Vercel cron (Discovery opens + optional Amplitude tile/CTA).
 */
export async function POST(request: NextRequest, { params }: Context) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const result = await syncAnnouncementEngagementById(id)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data: announcement, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('id', id)
    .single<Announcement>()

  if (error || !announcement) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to load announcement after sync' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    syncedAt: result.syncedAt,
    announcement,
  })
}
