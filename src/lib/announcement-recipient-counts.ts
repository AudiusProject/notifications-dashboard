import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE = 10_000

/**
 * Count `announcement_recipients` rows per `announcement_id` (handles > default row limit).
 */
export async function fetchRecipientCountByAnnouncementId(
  supabase: SupabaseClient,
  announcementIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (announcementIds.length === 0) {
    return counts
  }

  let offset = 0
  for (;;) {
    const { data, error } = await supabase
      .from('announcement_recipients')
      .select('announcement_id')
      .in('announcement_id', announcementIds)
      .range(offset, offset + PAGE - 1)

    if (error) {
      console.error('announcement_recipients fetch:', error.message)
      break
    }
    const batch = data ?? []
    if (batch.length === 0) break

    for (const row of batch) {
      const id = row.announcement_id as string
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }

    if (batch.length < PAGE) break
    offset += PAGE
  }

  return counts
}

/** Exact row count for one announcement (`announcement_recipients`, head-only). */
export async function fetchRecipientCountForAnnouncement(
  supabase: SupabaseClient,
  announcementId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('announcement_recipients')
    .select('*', { count: 'exact', head: true })
    .eq('announcement_id', announcementId)

  if (error) {
    console.error('announcement_recipients count:', error.message)
    return 0
  }
  return count ?? 0
}

const RECIPIENT_USER_IDS_PAGE = 1000

/**
 * All `user_id` values for one announcement. Paginated: PostgREST/Supabase
 * defaults to at most 1000 rows per response unless `.range()` is used.
 */
export async function fetchRecipientUserIdsForAnnouncement(
  supabase: SupabaseClient,
  announcementId: string
): Promise<number[]> {
  const userIds: number[] = []
  let offset = 0

  for (;;) {
    const { data, error } = await supabase
      .from('announcement_recipients')
      .select('user_id')
      .eq('announcement_id', announcementId)
      .order('user_id', { ascending: true })
      .range(offset, offset + RECIPIENT_USER_IDS_PAGE - 1)

    if (error) {
      console.error('announcement_recipients user_id fetch:', error.message)
      break
    }

    const batch = data ?? []
    if (batch.length === 0) break

    for (const row of batch) {
      userIds.push(row.user_id as number)
    }

    offset += batch.length
    if (batch.length < RECIPIENT_USER_IDS_PAGE) break
  }

  return userIds
}
