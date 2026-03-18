import { createClient } from '@supabase/supabase-js'

let admin: ReturnType<typeof createClient> | null = null

export function getSupabaseAdmin() {
  if (admin) return admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  admin = createClient(url, key)
  return admin
}
