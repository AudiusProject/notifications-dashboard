/**
 * First-party push open counts stored in Discovery (api.audius.co / v1).
 * Requires the same secret as `notificationCampaignOpenMetricsSecret` on the API.
 */

const METRICS_HEADER = 'X-Notification-Campaign-Metrics-Secret'

export function notificationCampaignOpenMetricsConfigured(): boolean {
  return Boolean(
    process.env.AUDIUS_API_URL?.trim() &&
      process.env.NOTIFICATION_CAMPAIGN_OPEN_METRICS_SECRET?.trim()
  )
}

/**
 * Distinct users who recorded an open for this internal notification campaign id
 * (e.g. Supabase `announcements.id`).
 */
export async function fetchNotificationCampaignPushOpenCount(
  campaignId: string
): Promise<number> {
  const base = process.env.AUDIUS_API_URL?.trim().replace(/\/$/, '')
  const secret = process.env.NOTIFICATION_CAMPAIGN_OPEN_METRICS_SECRET?.trim()
  if (!base || !secret) {
    throw new Error(
      'Discovery open metrics not configured: set AUDIUS_API_URL and NOTIFICATION_CAMPAIGN_OPEN_METRICS_SECRET'
    )
  }

  const url = `${base}/v1/notifications/campaigns/${encodeURIComponent(campaignId)}/opens`
  const res = await fetch(url, {
    headers: { [METRICS_HEADER]: secret },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `Discovery open metrics failed (${res.status}): ${body.slice(0, 500)}`
    )
  }

  const json = (await res.json()) as {
    data?: { unique_opens?: number }
  }
  const n = json.data?.unique_opens
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error('Discovery open metrics: missing data.unique_opens')
  }
  return n
}
