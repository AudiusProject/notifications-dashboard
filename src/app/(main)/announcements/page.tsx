export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnnouncementsTable } from './announcements-table'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Announcement } from '@/lib/supabase/types'

export default async function AnnouncementsPage() {
  const supabase = getSupabaseAdmin()
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .returns<Announcement[]>()

  return (
    <div className="p-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
          <p className="text-sm text-neutral-500">
            Manage and review sent, drafted, and ready notifications.
          </p>
        </div>
        <Button render={<Link href="/announcements/new" />}>
          <Plus className="mr-2 size-4" />
          Create Announcement
        </Button>
      </div>
      <AnnouncementsTable announcements={announcements ?? []} />
    </div>
  )
}
