import { Pool } from 'pg'

let pool: Pool | null = null

export function getDiscoveryDb(): Pool {
  if (!pool) {
    const url = process.env.DN_DB_URL
    if (!url) throw new Error('DN_DB_URL is not set')
    pool = new Pool({ connectionString: url, max: 2 })
  }
  return pool
}

export async function findInactiveUsers(
  hours: number,
  windowHours: number,
  limit: number
): Promise<number[]> {
  const db = getDiscoveryDb()
  const result = await db.query<{ user_id: number }>(
    `
      SELECT p.user_id
      FROM plays p
      WHERE p.user_id IS NOT NULL
        AND p.created_at >= now() - ($1 * interval '1 hour')
        AND p.created_at < now() - ($2 * interval '1 hour')
        AND NOT EXISTS (
          SELECT 1
          FROM plays p2
          WHERE p2.user_id = p.user_id
            AND p2.created_at >= now() - ($2 * interval '1 hour')
        )
      GROUP BY p.user_id
      LIMIT $3
    `,
    [hours + windowHours, hours, limit]
  )
  return result.rows.map((r) => r.user_id)
}
