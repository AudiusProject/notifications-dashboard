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
