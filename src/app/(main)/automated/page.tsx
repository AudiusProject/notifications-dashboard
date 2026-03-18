export const dynamic = 'force-dynamic'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { AutomatedList } from './automated-list'
import type { AutomatedTrigger } from '@/lib/supabase/types'

export default async function AutomatedPage() {
  const supabase = getSupabaseAdmin()
  const { data: triggers } = await supabase
    .from('automated_triggers')
    .select('*')
    .order('trigger_hours', { ascending: true })
    .returns<AutomatedTrigger[]>()

  return (
    <div className="p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Automated Notifications
        </h1>
        <p className="text-sm text-neutral-500">
          Customize copy for system-driven triggers.
        </p>
      </div>
      <AutomatedList triggers={triggers ?? []} />
    </div>
  )
}
