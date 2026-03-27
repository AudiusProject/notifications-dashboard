import { fetchRecipientCountForAnnouncement } from '@/lib/announcement-recipient-counts'
import {
  fetchNotificationCampaignPushOpenCount,
  notificationCampaignOpenMetricsConfigured,
} from '@/lib/discovery/notificationCampaignPushOpens'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Announcement } from '@/lib/supabase/types'

export type AnnouncementRow = {
  id: string
  sent_at: string | null
  funnel_sent: number | null
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
 * Syncs push open counts from Discovery (Audius API) into `announcements`.
 * Open rate denominator = `announcement_recipients` count (not `funnel_sent`).
 * Used by Vercel cron and manual "Sync metrics".
 */
export async function syncAnnouncementEngagementById(
  announcementId: string
): Promise<
  { ok: true; syncedAt: string } | { ok: false; error: string }
> {
  if (!notificationCampaignOpenMetricsConfigured()) {
    return {
      ok: false,
      error:
        'Metrics sync not configured: set AUDIUS_API_URL and NOTIFICATION_CAMPAIGN_OPEN_METRICS_SECRET',
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

  const r = row as Pick<Announcement, 'id' | 'status' | 'sent_at'>

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

    const pushOpens = await fetchNotificationCampaignPushOpenCount(r.id)
    const openRate = computeRatePercent(recipientCount, pushOpens)
    const syncedAt = new Date().toISOString()

    const { error: upErr } = await supabase
      .from('announcements')
      .update({
        funnel_opened: pushOpens,
        unique_opens: pushOpens,
        open_rate: openRate,
        engagement_metrics_synced_at: syncedAt,
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
