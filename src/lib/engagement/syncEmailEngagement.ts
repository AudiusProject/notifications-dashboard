import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, EmailEvent } from '@/lib/supabase/types'

type EmailEventType = EmailEvent['event_type']

/**
 * Aggregates `email_events` into `announcements.email_*` columns.
 *
 * Uses distinct `user_id` for clicks (matches push "unique opens" semantics
 * on the dashboard). Total `processed` / `delivered` / `bounced` are
 * non-distinct — those are delivery-infrastructure counts.
 *
 * Opens are NOT aggregated: Apple Mail Privacy Protection pre-fetches
 * tracking pixels for ~50% of email traffic, which makes the metric noise.
 * Raw `open` events are still written to `email_events` by the webhook in
 * case we ever want them back — we just don't roll them up into the
 * announcement. Click rate is the trustworthy email signal.
 */

type EventCounts = {
  processed: number
  delivered: number
  clicked: number // distinct user_id
  bounced: number
  unsubscribed: number
  spamReported: number
}

async function countDistinct(
  supabase: SupabaseClient<Database>,
  announcementId: string,
  eventType: EmailEventType
): Promise<number> {
  // Distinct user_id count. Supabase doesn't expose COUNT(DISTINCT) directly
  // via PostgREST, so we select unique user_ids and count in JS. For typical
  // announcement volumes (~100k recipients) this is fine; revisit with an
  // RPC if sizes grow much larger.
  const { data, error } = await supabase
    .from('email_events')
    .select('user_id')
    .eq('announcement_id', announcementId)
    .eq('event_type', eventType)
    .not('user_id', 'is', null)
  if (error) throw new Error(`distinct ${eventType}: ${error.message}`)
  const s = new Set<string>()
  for (const row of data ?? []) {
    if (row.user_id) s.add(row.user_id)
  }
  return s.size
}

async function countTotal(
  supabase: SupabaseClient<Database>,
  announcementId: string,
  eventType: EmailEventType
): Promise<number> {
  const { count, error } = await supabase
    .from('email_events')
    .select('sg_event_id', { count: 'exact', head: true })
    .eq('announcement_id', announcementId)
    .eq('event_type', eventType)
  if (error) throw new Error(`count ${eventType}: ${error.message}`)
  return count ?? 0
}

async function collectCounts(
  supabase: SupabaseClient<Database>,
  announcementId: string
): Promise<EventCounts> {
  const [
    processed,
    delivered,
    clicked,
    bounced,
    unsubscribed,
    spamReported,
  ] = await Promise.all([
    countTotal(supabase, announcementId, 'processed'),
    countTotal(supabase, announcementId, 'delivered'),
    countDistinct(supabase, announcementId, 'click'),
    countTotal(supabase, announcementId, 'bounce'),
    countTotal(supabase, announcementId, 'unsubscribe'),
    countTotal(supabase, announcementId, 'spamreport'),
  ])
  return {
    processed,
    delivered,
    clicked,
    bounced,
    unsubscribed,
    spamReported,
  }
}

export async function syncEmailEngagementById(
  announcementId: string
): Promise<
  { ok: true; syncedAt: string; counts: EventCounts } | { ok: false; error: string }
> {
  const supabase = getSupabaseAdmin()
  try {
    const counts = await collectCounts(supabase, announcementId)
    const syncedAt = new Date().toISOString()

    const { error: upErr } = await supabase
      .from('announcements')
      .update({
        email_sent: counts.processed,
        email_delivered: counts.delivered,
        email_clicked: counts.clicked,
        email_bounced: counts.bounced,
        email_unsubscribed: counts.unsubscribed,
        email_spam_reported: counts.spamReported,
        email_metrics_synced_at: syncedAt,
        updated_at: syncedAt,
      })
      .eq('id', announcementId)

    if (upErr) {
      return { ok: false, error: upErr.message }
    }
    return { ok: true, syncedAt, counts }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/** For the "Top links" table on the announcement detail page. */
export async function fetchTopClickedLinks(
  announcementId: string,
  limit = 10
): Promise<Array<{ url: string; clicks: number; unique_users: number }>> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('email_events')
    .select('url, user_id')
    .eq('announcement_id', announcementId)
    .eq('event_type', 'click')
    .not('url', 'is', null)
  if (error) throw new Error(error.message)

  const byUrl = new Map<string, { clicks: number; users: Set<string> }>()
  for (const row of data ?? []) {
    if (!row.url) continue
    let bucket = byUrl.get(row.url)
    if (!bucket) {
      bucket = { clicks: 0, users: new Set() }
      byUrl.set(row.url, bucket)
    }
    bucket.clicks += 1
    if (row.user_id) bucket.users.add(row.user_id)
  }

  return Array.from(byUrl.entries())
    .map(([url, v]) => ({
      url,
      clicks: v.clicks,
      unique_users: v.users.size,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit)
}
