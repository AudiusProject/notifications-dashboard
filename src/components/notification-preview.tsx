'use client'

import { useEffect, useState } from 'react'
import { ImageOff, Smartphone } from 'lucide-react'

import { cn } from '@/lib/utils'

type NotificationPreviewProps = {
  heading: string
  body: string
  imageUrl?: string | null
}

const messages = {
  bannerLabel: 'Banner',
  expandedLabel: 'Expanded',
  imageError: 'Could not load image',
  footnote: 'Preview is approximate. Layout varies by OS version.',
}

function PreviewImage({
  src,
  className,
  rounded = 'rounded-lg',
}: {
  src: string
  className?: string
  rounded?: string
}) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (failed) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-1 border border-dashed border-neutral-200 bg-neutral-50 text-neutral-400',
          rounded,
          className
        )}
      >
        <ImageOff className="size-5" />
        <span className="px-1 text-center text-[10px] leading-tight">
          {messages.imageError}
        </span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- blob + external preview URLs
    <img
      src={src}
      alt=""
      className={cn(rounded, className)}
      onError={() => setFailed(true)}
    />
  )
}

export function NotificationPreview({
  heading,
  body,
  imageUrl = null,
}: NotificationPreviewProps) {
  const title = heading.trim() || 'Notification heading'
  const subtitle = body.trim() || 'Enter short description…'
  const hasImage = Boolean(imageUrl?.trim())

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="size-4 text-neutral-400" />
        <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Notification preview
        </span>
      </div>

      <div className="mx-auto w-80 space-y-4 rounded-3xl bg-neutral-100 px-5 py-6 shadow-sm">
        {/* Collapsed banner — text + trailing thumbnail (common rich push layout) */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            {messages.bannerLabel}
          </p>
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
            <div
              className={cn(
                'px-3 py-3',
                hasImage ? 'flex gap-3' : 'space-y-1'
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold leading-snug text-neutral-900">
                  {title}
                </p>
                <p className="line-clamp-3 text-xs leading-relaxed text-neutral-500">
                  {subtitle}
                </p>
              </div>
              {hasImage ? (
                <PreviewImage
                  src={imageUrl!.trim()}
                  className="size-[4.5rem] shrink-0 object-cover"
                  rounded="rounded-xl"
                />
              ) : null}
            </div>
          </div>
        </div>

        {/* Expanded rich notification — full-width attachment + text */}
        {hasImage ? (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              {messages.expandedLabel}
            </p>
            <div className="overflow-hidden rounded-2xl border bg-white shadow-md">
              <PreviewImage
                src={imageUrl!.trim()}
                className="aspect-[16/9] w-full object-cover"
                rounded="rounded-t-2xl"
              />
              <div className="border-t border-neutral-100 px-3 py-3">
                <div className="flex items-center gap-1.5 pb-2">
                  <div className="flex size-5 items-center justify-center rounded bg-neutral-900 text-[10px] font-bold text-white">
                    A
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Audius
                  </span>
                  <span className="text-[10px] text-neutral-400">· now</span>
                </div>
                <p className="text-sm font-semibold text-neutral-900">
                  {title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  {subtitle}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <p className="text-center text-xs text-neutral-500">{messages.footnote}</p>
    </div>
  )
}
