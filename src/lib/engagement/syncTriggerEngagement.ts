import {
  fetchNotificationCampaignPushOpenCount,
  notificationCampaignOpenMetricsConfigured,
} from '@/lib/discovery/notificationCampaignPushOpens'
import { computeRatePercent } from '@/lib/engagement/syncAnnouncementEngagement'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Syncs push open metrics from Discovery into a single `automated_triggers` row.
 *
 * audience_reached_30d — distinct sends in the last 30 days (from trigger_sends).
 * open_rate_30d        — lifetime unique opens (Discovery) / lifetime total sends.
 *                        Using lifetime totals avoids the need for date-filtered
 *                        opens from the Discovery API, which doesn't support it.
 *                        The rate stabilises quickly and is a good proxy for the
 *                        steady-state open rate of a recurring trigger.
 */
export async function syncTriggerEngagementById(
  triggerId: string
): Promise<{ ok: true; syncedAt: string } | { ok: false; error: string }> {
  if (!notificationCampaignOpenMetricsConfigured()) {
    return {
      ok: false,
      error:
        'Metrics sync not configured: set AUDIUS_API_URL and NOTIFICATION_CAMPAIGN_OPEN_METRICS_SECRET',
    }
  }

  const supabase = getSupabaseAdmin()

  // 30-day audience: distinct users sent this trigger in the last 30 days.
  const since30d = new Date(Date.now() - THIRTY_DAYS_MS).toISOString()
  const { count: audienceReached30d, error: countErr } = await supabase
    .from('trigger_sends')
    .select('*', { count: 'exact', head: true })
    .eq('trigger_id', triggerId)
    .gte('sent_at', since30d)

  if (countErr) {
    return { ok: false, error: `trigger_sends count: ${countErr.message}` }
  }

  // Lifetime sends: denominator for open rate.
  const { count: totalSends, error: totalErr } = await supabase
    .from('trigger_sends')
    .select('*', { count: 'exact', head: true })
    .eq('trigger_id', triggerId)

  if (totalErr) {
    return { ok: false, error: `trigger_sends total: ${totalErr.message}` }
  }

  // Lifetime unique opens from Discovery (same endpoint as announcements).
  let pushOpens = 0
  try {
    pushOpens = await fetchNotificationCampaignPushOpenCount(triggerId)
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }

  const openRate = computeRatePercent(totalSends ?? 0, pushOpens)
  const syncedAt = new Date().toISOString()

  const { error: upErr } = await supabase
    .from('automated_triggers')
    .update({
      audience_reached_30d: audienceReached30d ?? 0,
      open_rate_30d: openRate,
      engagement_metrics_synced_at: syncedAt,
      updated_at: syncedAt,
    })
    .eq('id', triggerId)

  if (upErr) {
    return { ok: false, error: upErr.message }
  }

  return { ok: true, syncedAt }
}

/**
 * Syncs engagement for all active triggers. Used by the Vercel cron.
 */
export async function syncAllTriggerEngagement(): Promise<
  Array<{ id: string; ok: boolean; error?: string }>
> {
  const supabase = getSupabaseAdmin()
  const { data: triggers, error } = await supabase
    .from('automated_triggers')
    .select('id')
    .eq('is_active', true)

  if (error || !triggers) {
    return []
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = []
  for (const trigger of triggers) {
    const result = await syncTriggerEngagementById(trigger.id)
    results.push(
      result.ok
        ? { id: trigger.id, ok: true }
        : { id: trigger.id, ok: false, error: result.error }
    )
  }
  return results
}
