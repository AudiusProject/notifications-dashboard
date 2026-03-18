'use client'

import { Smartphone } from 'lucide-react'

type NotificationPreviewProps = {
  heading: string
  body: string
}

export function NotificationPreview({
  heading,
  body,
}: NotificationPreviewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="size-4 text-neutral-400" />
        <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Notification Preview
        </span>
      </div>
      <div className="mx-auto w-80 rounded-3xl bg-neutral-100 px-6 pt-6 shadow-sm">
        <div className="overflow-hidden rounded-2xl border bg-white shadow-md">
          <div className="flex items-center justify-between border-b border-neutral-100 bg-white/50 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <div className="flex size-5 items-center justify-center rounded bg-neutral-900 text-[10px] font-bold text-white">
                A
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Audius
              </span>
            </div>
            <span className="text-[10px] text-neutral-400">now</span>
          </div>
          <div className="space-y-1.5 px-4 pb-4 pt-4">
            <p className="text-sm font-semibold text-neutral-900">
              {heading || 'Notification heading'}
            </p>
            <p className="text-xs leading-relaxed text-neutral-500">
              {body || 'Enter short description...'}
            </p>
          </div>
        </div>
        <div className="h-6" />
      </div>
      <p className="text-center text-xs text-neutral-500">
        Preview is approximate. Layout may vary slightly by device OS.
      </p>
    </div>
  )
}
