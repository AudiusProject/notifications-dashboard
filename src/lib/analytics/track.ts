import { after } from 'next/server'

import type { DashboardAnalyticsEventName } from './events'

const AMPLITUDE_HTTP_API = 'https://api2.amplitude.com/2/httpapi'

const MAX_ERROR_LEN = 500

/** Truncate for Amplitude — avoids huge payloads if upstream errors include HTML. */
export function truncateForAnalytics(value: string, max = MAX_ERROR_LEN): string {
  const oneLine = value.replace(/\s+/g, ' ').trim()
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`
}

/**
 * Sends one event to Amplitude HTTP API (server-side).
 * No-op if `AMPLITUDE_API_KEY` is unset.
 */
export async function trackDashboardEvent(
  userId: string,
  eventType: DashboardAnalyticsEventName,
  eventProperties: Record<string, unknown> = {}
): Promise<void> {
  const apiKey = process.env.AMPLITUDE_API_KEY
  if (!apiKey || !userId) return

  const body = {
    api_key: apiKey,
    events: [
      {
        user_id: userId,
        event_type: eventType,
        event_properties: eventProperties,
        time: Date.now(),
      },
    ],
  }

  const res = await fetch(AMPLITUDE_HTTP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.warn('[analytics] Amplitude HTTP error:', res.status, text)
  }
}

/**
 * Schedule analytics after the response is ready (Next.js `after`).
 * Prefer this in route handlers so Amplitude latency does not block the client.
 */
export function scheduleDashboardAnalytics(
  userId: string,
  eventType: DashboardAnalyticsEventName,
  eventProperties: Record<string, unknown> = {}
): void {
  after(() => {
    void trackDashboardEvent(userId, eventType, eventProperties).catch((err) => {
      console.warn('[analytics] track failed:', err)
    })
  })
}
