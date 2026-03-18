'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Zap, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EditCopyDialog } from '@/components/edit-copy-dialog'
import type { AutomatedTrigger } from '@/lib/supabase/types'

type Props = { triggers: AutomatedTrigger[] }

export function AutomatedList({ triggers: initial }: Props) {
  const [search, setSearch] = useState('')
  const [triggers, setTriggers] = useState(initial)
  const [editingTrigger, setEditingTrigger] = useState<AutomatedTrigger | null>(
    null
  )

  const filtered = triggers.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.heading.toLowerCase().includes(search.toLowerCase())
  )

  function handleSaved(updated: AutomatedTrigger) {
    setTriggers((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    )
    setEditingTrigger(null)
  }

  return (
    <>
      <div className="mb-6">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search triggers..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((trigger) => (
          <Card key={trigger.id}>
            <CardContent className="flex items-start gap-6 p-6">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
                <Zap className="size-5 text-amber-600" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold">{trigger.name}</h3>
                  <Badge
                    variant={trigger.is_active ? 'default' : 'secondary'}
                    className={
                      trigger.is_active
                        ? 'bg-green-100 text-green-800 hover:bg-green-100'
                        : ''
                    }
                  >
                    {trigger.is_active ? 'Active' : 'Paused'}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-neutral-500">
                  <Clock className="size-3.5" />
                  {trigger.trigger_condition}
                </div>

                <div className="mt-3 rounded-md border-l-2 border-amber-300 bg-amber-50/50 px-3 py-2">
                  <p className="text-sm font-medium">{trigger.heading}</p>
                  <p className="text-xs text-neutral-500">{trigger.body}</p>
                </div>

                <p className="mt-3 text-xs text-neutral-400">
                  Last updated{' '}
                  {new Date(trigger.updated_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  by {trigger.last_updated_by ?? 'Unknown'}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" render={<Link href={`/automated/${trigger.id}`} />}>
                  View Metrics
                </Button>
                <Button size="sm" onClick={() => setEditingTrigger(trigger)}>
                  ✏️ Edit Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingTrigger ? (
        <EditCopyDialog
          trigger={editingTrigger}
          open={!!editingTrigger}
          onOpenChange={(open) => {
            if (!open) setEditingTrigger(null)
          }}
          onSaved={handleSaved}
        />
      ) : null}
    </>
  )
}
