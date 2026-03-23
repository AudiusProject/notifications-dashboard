import { getSupabaseAdmin } from '@/lib/supabase/admin'

import {
  fetchEventSegmentation,
  type AmplitudeEventFilter,
} from './segmentation'
import {
  AmplitudeEngagementEvents,
  TILE_KIND_ANNOUNCEMENT,
} from './engagementEvents'

/**
 * Amplitude only accepts segmentation filters for properties that have appeared on at least one
 * ingested event for that event type — UI/schema alone is not enough (API returns 400).
 * Order: snake_case first (historical sends), then camelCase (new clients).
 */
const DASHBOARD_ID_PROPS = [
  'dashboard_announcement_id',
  'dashboardAnnouncementId',
] as const

function isUnknownEventPropertySegmentationError(message: string): boolean {
  return (
    message.includes('does not exist on this event type') ||
    message.includes('Invalid event property')
  )
}

export type AnnouncementRow = {
  id: string
  sent_at: string | null
  funnel_sent: number | null
}

/** YYYYMMDD in UTC */
export function toAmplitudeDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export async function fetchEngagementCountsForAnnouncement(
  announcementId: string,
  sentAtIso: string
): Promise<{ pushOpens: number; tileClicks: number }> {
  const sent = new Date(sentAtIso)
  const now = new Date()
  const start = toAmplitudeDate(sent)
  const end = toAmplitudeDate(now)

  const sumForProps = async (params: {
    eventType: string
    extraFilters?: AmplitudeEventFilter[]
  }) => {
    let sum = 0
    for (const subprop_key of DASHBOARD_ID_PROPS) {
      const idFilter = {
        subprop_type: 'event' as const,
        subprop_key,
        subprop_op: 'is' as const,
        subprop_value: [announcementId],
      }
      const filters = [idFilter, ...(params.extraFilters ?? [])]
      try {
        const res = await fetchEventSegmentation({
          event: {
            event_type: params.eventType,
            filters,
          },
          start,
          end,
          m: 'totals',
        })
        sum += res.sum
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('400') && isUnknownEventPropertySegmentationError(msg)) {
          console.warn(
            `[amplitude] Skipping segmentation on "${subprop_key}" for "${params.eventType}" (property not yet seen in ingested data): ${msg.slice(0, 200)}`
          )
          continue
        }
        throw e
      }
    }
    return sum
  }

  const kindFilter = {
    subprop_type: 'event' as const,
    subprop_key: 'kind',
    subprop_op: 'is' as const,
    subprop_value: [TILE_KIND_ANNOUNCEMENT],
  }

  const [pushOpens, tileClicks] = await Promise.all([
    sumForProps({ eventType: AmplitudeEngagementEvents.OPEN_PUSH_NOTIFICATION }),
    sumForProps({
      eventType: AmplitudeEngagementEvents.CLICK_TILE,
      extraFilters: [kindFilter],
    }),
  ])

  return {
    pushOpens,
    tileClicks,
  }
}

export function computeRates(params: {
  funnelSent: number | null
  pushOpens: number
  tileClicks: number
}): {
  open_rate: number | null
  cta_click_rate: number | null
} {
  const denom = params.funnelSent ?? 0
  if (denom <= 0) {
    return { open_rate: null, cta_click_rate: null }
  }
  const openRate = Math.round((params.pushOpens / denom) * 10000) / 100
  const ctaRate = Math.round((params.tileClicks / denom) * 10000) / 100
  return { open_rate: openRate, cta_click_rate: ctaRate }
}

/**
 * Fetches Amplitude counts and updates `announcements` for one row.
 * Used by Vercel cron and manual "Sync metrics".
 */
export async function syncAnnouncementEngagementById(
  announcementId: string
): Promise<
  { ok: true; syncedAt: string } | { ok: false; error: string }
> {
  if (
    !process.env.AMPLITUDE_API_KEY?.trim() ||
    !process.env.AMPLITUDE_SECRET_KEY?.trim()
  ) {
    return {
      ok: false,
      error:
        'Amplitude read credentials missing: set AMPLITUDE_API_KEY and AMPLITUDE_SECRET_KEY',
    }
  }

  const supabase = getSupabaseAdmin()
  const { data: row, error: fetchErr } = await supabase
    .from('announcements')
    .select('id, status, sent_at, funnel_sent')
    .eq('id', announcementId)
    .single()

  if (fetchErr || !row) {
    return { ok: false, error: fetchErr?.message ?? 'Announcement not found' }
  }

  const r = row as {
    id: string
    status: string
    sent_at: string | null
    funnel_sent: number | null
  }

  if (r.status !== 'sent' || !r.sent_at) {
    return {
      ok: false,
      error: 'Only sent announcements with a send date can be synced',
    }
  }

  try {
    const counts = await fetchEngagementCountsForAnnouncement(
      r.id,
      r.sent_at
    )
    const rates = computeRates({
      funnelSent: r.funnel_sent,
      pushOpens: counts.pushOpens,
      tileClicks: counts.tileClicks,
    })

    const syncedAt = new Date().toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase client not generated from schema
    const { error: upErr } = await (supabase as any)
      .from('announcements')
      .update({
        funnel_opened: counts.pushOpens,
        funnel_clicked: counts.tileClicks,
        cta_clicks: counts.tileClicks,
        open_rate: rates.open_rate,
        cta_click_rate: rates.cta_click_rate,
        amplitude_engagement_synced_at: syncedAt,
        updated_at: syncedAt,
      })
      .eq('id', r.id)

    if (upErr) {
      return { ok: false, error: upErr.message }
    }

    return { ok: true, syncedAt }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message }
  }
}
