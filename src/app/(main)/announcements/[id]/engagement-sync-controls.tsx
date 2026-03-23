'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatEngagementSyncedAt } from '@/lib/utils'

const messages = {
  sync: 'Sync metrics',
  syncing: 'Syncing…',
  hint: 'Pulls latest counts from Amplitude (same as the hourly cron).',
}

type Props = {
  announcementId: string
  /** ISO string or null */
  syncedAt: string | null
}

export function EngagementSyncControls({ announcementId, syncedAt }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSync() {
    if (pending) return
    setError(null)
    setPending(true)
    try {
      const res = await fetch(
        `/api/announcements/${announcementId}/sync-engagement`,
        { method: 'POST' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`)
        return
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2 text-right">
      <p className="text-xs text-neutral-500">
        Last synced:{' '}
        <span className="font-medium text-neutral-700">
          {formatEngagementSyncedAt(syncedAt)}
        </span>
      </p>
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={pending}
        >
          {pending ? (
            messages.syncing
          ) : (
            <>
              <RefreshCw className="mr-2 size-4" />
              {messages.sync}
            </>
          )}
        </Button>
        <p className="max-w-[280px] text-[11px] text-neutral-400">
          {messages.hint}
        </p>
        {error ? (
          <span className="text-xs text-red-600">{error}</span>
        ) : null}
      </div>
    </div>
  )
}
