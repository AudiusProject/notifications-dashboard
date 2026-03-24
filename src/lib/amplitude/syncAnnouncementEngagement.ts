import { fetchRecipientCountForAnnouncement } from '@/lib/announcement-recipient-counts'
import {
  fetchNotificationCampaignPushOpenCount,
  notificationCampaignOpenMetricsConfigured,
} from '@/lib/discovery/notificationCampaignPushOpens'
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
 * Order: snake_case first, then camelCase.
 */
const CAMPAIGN_ID_PROPS = [
  'notification_campaign_id',
  'notificationCampaignId',
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
    for (const subprop_key of CAMPAIGN_ID_PROPS) {
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

/** Percent 0–100 (one decimal), capped; denominator = announcement_recipients rows. */
export function computeRatePercent(
  recipientCount: number,
  eventCount: number
): number | null {
  if (recipientCount <= 0 || !Number.isFinite(eventCount)) {
    return null
  }
  const raw = (eventCount / recipientCount) * 100
  const rounded = Math.round(raw * 100) / 100
  return Math.min(100, rounded)
}

/**
 * Syncs engagement into `announcements`: push opens from Discovery when configured,
 * else from Amplitude; tile/CTA metrics from Amplitude when keys are set.
 * Open rate denominator = `announcement_recipients` count (not `funnel_sent`).
 * Used by Vercel cron and manual "Sync metrics".
 */
export async function syncAnnouncementEngagementById(
  announcementId: string
): Promise<
  { ok: true; syncedAt: string } | { ok: false; error: string }
> {
  const hasAmplitude =
    Boolean(process.env.AMPLITUDE_API_KEY?.trim()) &&
    Boolean(process.env.AMPLITUDE_SECRET_KEY?.trim())
  const hasDiscoveryOpens = notificationCampaignOpenMetricsConfigured()

  if (!hasAmplitude && !hasDiscoveryOpens) {
    return {
      ok: false,
      error:
        'Metrics sync not configured: set AUDIUS_API_URL + NOTIFICATION_CAMPAIGN_OPEN_METRICS_SECRET for first-party opens, and/or AMPLITUDE_API_KEY + AMPLITUDE_SECRET_KEY for tile/CTA analytics',
    }
  }

  const supabase = getSupabaseAdmin()
  const { data: row, error: fetchErr } = await supabase
    .from('announcements')
    .select('id, status, sent_at')
    .eq('id', announcementId)
    .single()

  if (fetchErr || !row) {
    return { ok: false, error: fetchErr?.message ?? 'Announcement not found' }
  }

  const r = row as {
    id: string
    status: string
    sent_at: string | null
  }

  if (r.status !== 'sent' || !r.sent_at) {
    return {
      ok: false,
      error: 'Only sent announcements with a send date can be synced',
    }
  }

  try {
    const recipientCount = await fetchRecipientCountForAnnouncement(
      supabase,
      r.id
    )

    let pushOpens: number
    let tileClicks: number | undefined

    if (hasAmplitude) {
      const counts = await fetchEngagementCountsForAnnouncement(r.id, r.sent_at)
      tileClicks = counts.tileClicks
      pushOpens = hasDiscoveryOpens
        ? await fetchNotificationCampaignPushOpenCount(r.id)
        : counts.pushOpens
    } else {
      pushOpens = await fetchNotificationCampaignPushOpenCount(r.id)
    }

    const openRate = computeRatePercent(recipientCount, pushOpens)
    const syncedAt = new Date().toISOString()

    const updatePayload: Record<string, unknown> = {
      funnel_opened: pushOpens,
      unique_opens: pushOpens,
      open_rate: openRate,
      amplitude_engagement_synced_at: syncedAt,
      updated_at: syncedAt,
    }

    if (hasAmplitude && tileClicks !== undefined) {
      updatePayload.funnel_clicked = tileClicks
      updatePayload.cta_clicks = tileClicks
      updatePayload.cta_click_rate = computeRatePercent(
        recipientCount,
        tileClicks
      )
    }

    const { error: upErr } = await supabase
      .from('announcements')
      .update(updatePayload)
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
