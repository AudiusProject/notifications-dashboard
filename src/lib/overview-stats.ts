/** Rolling window for “last 30 days” (announcement sends). */
export function getThirtyDaysAgoIso(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 30)
  return d.toISOString()
}

/** e.g. 2400000 → "2.4M", 12000 → "12.0K" */
export function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}M`
  }
  if (n >= 1_000) {
    const v = n / 1_000
    return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10}K`
  }
  return String(Math.round(n))
}

/** Percent 0–100, one decimal. */
export function formatPercent1dp(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value * 10) / 10
  return `${rounded}%`
}

export type AnnouncementAggregateRow = {
  id: string
  unique_opens: number | null
  funnel_opened: number | null
}

/** Total rows in `announcement_recipients` for the selected announcements (sum of per-id counts). */
export function sumRecipientCounts(
  recipientCountByAnnouncementId: Map<string, number>
): number {
  let sum = 0
  for (const n of recipientCountByAnnouncementId.values()) {
    sum += n
  }
  return sum
}

/**
 * Reach = `announcement_recipients` rows only (no funnel_sent / audience_size).
 * Open rate = sum(opens) / sum(recipient reach), counting opens only for sends that have recipients.
 */
export function computeAnnouncementReachAndOpenRate(
  rows: AnnouncementAggregateRow[],
  recipientCountByAnnouncementId: Map<string, number>
): {
  audienceReachRecipientRows: number
  totalOpens: number
  openRatePercent: number | null
} {
  const audienceReachRecipientRows = sumRecipientCounts(
    recipientCountByAnnouncementId
  )

  let totalOpens = 0

  for (const a of rows) {
    const recipients = recipientCountByAnnouncementId.get(a.id) ?? 0
    if (recipients <= 0) {
      continue
    }

    const opens =
      a.unique_opens != null && a.unique_opens > 0
        ? a.unique_opens
        : a.funnel_opened != null && a.funnel_opened > 0
          ? a.funnel_opened
          : 0

    totalOpens += opens
  }

  if (audienceReachRecipientRows <= 0) {
    return {
      audienceReachRecipientRows: 0,
      totalOpens,
      openRatePercent: null,
    }
  }

  const raw = (totalOpens / audienceReachRecipientRows) * 100
  const openRatePercent = Math.min(100, raw)

  return {
    audienceReachRecipientRows,
    totalOpens,
    openRatePercent,
  }
}
