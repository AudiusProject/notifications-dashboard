import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from './types'

let admin: SupabaseClient<Database> | null = null

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (admin) return admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  admin = createClient<Database>(url, key)
  return admin
}
