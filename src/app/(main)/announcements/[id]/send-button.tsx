'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = { announcementId: string }

export function SendAnnouncementButton({ announcementId }: Props) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (sending) return
    setError(null)
    setSending(true)
    try {
      const res = await fetch(`/api/announcements/${announcementId}/send`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`)
        return
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handleSend}
        disabled={sending}
      >
        {sending ? (
          'Sending…'
        ) : (
          <>
            <Send className="mr-2 size-4" />
            Send Now
          </>
        )}
      </Button>
      {error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : null}
    </div>
  )
}
