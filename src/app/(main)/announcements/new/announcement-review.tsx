'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  FileUp,
  Send,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NotificationPreview } from '@/components/notification-preview'
import { cn } from '@/lib/utils'

import { useAnnouncementDraft } from './announcement-draft-context'

const messages = {
  title: 'Review Announcement',
  subtitle: 'Step 2: Review delivery assumptions and content',
  warningLead:
    'You are about to send an immediate notification.',
  warningBody:
    'Please review the targeting and copy carefully. This action cannot be undone once confirmed.',
  audienceSummary: 'Audience Summary',
  contentSummary: 'Content Summary',
  source: 'Source',
  totalRecipients: 'Total Recipients',
  validUsers: (n: number) =>
    `${n.toLocaleString('en-US')} valid users`,
  internalLabel: 'Internal Label',
  heading: 'Heading',
  body: 'Body',
  image: 'Image',
  ctaLink: 'CTA Link',
  none: 'None',
  confirmLabel:
    'I have reviewed the audience and copy. Send immediately.',
  saveDraft: 'Save Draft',
  backToEdit: 'Back to Edit',
  sendNow: 'Send Announcement Now',
  savingDraft: 'Saving…',
  sending: 'Sending…',
}

function countValidRecipientsFromText(text: string): number {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  return lines.filter((l) => /^\d+$/.test(l)).length
}

function imageSummaryLabel(
  imageSource: 'upload' | 'url',
  imageFile: File | null,
  imageUrlInput: string
): string {
  if (imageSource === 'upload' && imageFile) return imageFile.name
  const raw = imageUrlInput.trim()
  if (!raw) return messages.none
  try {
    const u = new URL(raw)
    const seg = u.pathname.split('/').filter(Boolean).pop()
    return seg ?? raw
  } catch {
    return raw
  }
}

type SummaryRowProps = {
  label: string
  value: string
  valueClassName?: string
  multiline?: boolean
}

function SummaryRow({
  label,
  value,
  valueClassName,
  multiline,
}: SummaryRowProps) {
  return (
    <div
      className={cn(
        'flex gap-4 border-b border-neutral-100 py-2 last:border-b-0',
        multiline ? 'items-start' : 'items-center justify-between'
      )}
    >
      <span className="shrink-0 text-sm text-neutral-500">{label}</span>
      <span
        className={cn(
          'min-w-0 max-w-[min(100%,24rem)] text-right text-sm font-medium text-neutral-950',
          multiline && 'whitespace-pre-wrap break-words',
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function AnnouncementReview() {
  const router = useRouter()
  const draft = useAnnouncementDraft()
  const {
    internalLabel,
    heading,
    body,
    ctaLink,
    csvFile,
    imageSource,
    imageFile,
    imageUrlInput,
    resetDraft,
  } = draft

  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState<'draft' | 'send' | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Prevents "incomplete draft" redirect after send when resetDraft() clears the form. */
  const skipIncompleteRedirectRef = useRef(false)

  const canReview = Boolean(
    internalLabel.trim() &&
      heading.trim() &&
      body.trim() &&
      csvFile
  )

  useEffect(() => {
    if (canReview) {
      skipIncompleteRedirectRef.current = false
    }
  }, [canReview])

  useEffect(() => {
    if (!canReview && !skipIncompleteRedirectRef.current) {
      router.replace('/announcements/new')
    }
  }, [canReview, router])

  useEffect(() => {
    if (!csvFile) {
      setRecipientCount(null)
      return
    }
    let cancelled = false
    csvFile.text().then((text) => {
      if (cancelled) return
      setRecipientCount(countValidRecipientsFromText(text))
    })
    return () => {
      cancelled = true
    }
  }, [csvFile])

  useEffect(() => {
    if (!imageFile) {
      setFilePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setFilePreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [imageFile])

  const previewImageUrl =
    imageSource === 'url'
      ? (imageUrlInput.trim() || null)
      : filePreviewUrl

  const imageLabel = imageSummaryLabel(
    imageSource,
    imageFile,
    imageUrlInput
  )

  const handleSaveDraft = useCallback(async () => {
    setPending('draft')
    setError(null)
    try {
      const formData = new FormData()
      formData.append('internal_label', internalLabel)
      formData.append('heading', heading)
      formData.append('body', body)
      formData.append('cta_link', ctaLink)
      formData.append('status', 'draft')
      if (csvFile) formData.append('csv', csvFile)
      if (imageSource === 'upload' && imageFile) {
        formData.append('image', imageFile)
      }
      if (imageSource === 'url' && imageUrlInput.trim()) {
        formData.append('image_url', imageUrlInput.trim())
      }

      const res = await fetch('/api/announcements', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Failed to save'
        )
      }
      const saved = (await res.json()) as { id?: string }
      if (typeof saved.id === 'string') {
        router.push(`/announcements/${saved.id}`)
      } else {
        router.push('/announcements')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setPending(null)
    }
  }, [
    internalLabel,
    heading,
    body,
    ctaLink,
    csvFile,
    imageSource,
    imageFile,
    imageUrlInput,
    router,
  ])

  const handleSend = useCallback(async () => {
    if (!csvFile || !confirmed) return
    setPending('send')
    setError(null)
    try {
      const formData = new FormData()
      formData.append('internal_label', internalLabel)
      formData.append('heading', heading)
      formData.append('body', body)
      formData.append('cta_link', ctaLink)
      formData.append('status', 'ready')
      formData.append('csv', csvFile)
      if (imageSource === 'upload' && imageFile) {
        formData.append('image', imageFile)
      }
      if (imageSource === 'url' && imageUrlInput.trim()) {
        formData.append('image_url', imageUrlInput.trim())
      }

      const createRes = await fetch('/api/announcements', { method: 'POST', body: formData })
      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}))
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Failed to save'
        )
      }
      const { id } = await createRes.json()

      const sendRes = await fetch(`/api/announcements/${id}/send`, {
        method: 'POST',
      })
      if (!sendRes.ok) {
        const data = await sendRes.json().catch(() => ({}))
        throw new Error(data.error ?? `Send failed (${sendRes.status})`)
      }

      skipIncompleteRedirectRef.current = true
      resetDraft()
      router.push(`/announcements/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setPending(null)
    }
  }, [
    confirmed,
    csvFile,
    heading,
    body,
    ctaLink,
    internalLabel,
    imageFile,
    imageSource,
    imageUrlInput,
    router,
    resetDraft,
  ])

  if (!canReview) {
    return null
  }

  return (
    <div className="p-10">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/announcements" />}>
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.title}
          </h1>
          <p className="text-sm text-neutral-500">
            {messages.subtitle}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <div
            className="flex gap-3 rounded-[10px] border border-amber-200 bg-amber-50 p-4"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div className="space-y-1 text-sm text-amber-950">
              <p className="font-medium">{messages.warningLead}</p>
              <p className="opacity-90">{messages.warningBody}</p>
            </div>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="size-5 text-neutral-700" />
                {messages.audienceSummary}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[10px] border border-neutral-100 bg-neutral-50 p-3">
                  <p className="text-xs text-neutral-500">{messages.source}</p>
                  <div className="mt-1 flex min-w-0 items-center gap-2 text-sm font-medium text-neutral-950">
                    <FileUp className="size-4 shrink-0 text-neutral-500" />
                    <span className="truncate">{csvFile?.name ?? '—'}</span>
                  </div>
                </div>
                <div className="rounded-[10px] border border-neutral-100 bg-neutral-50 p-3">
                  <p className="text-xs text-neutral-500">
                    {messages.totalRecipients}
                  </p>
                  <p className="mt-1 text-sm font-medium text-neutral-950">
                    {recipientCount === null
                      ? '…'
                      : messages.validUsers(recipientCount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="size-5 text-neutral-700" />
                {messages.contentSummary}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <SummaryRow label={messages.internalLabel} value={internalLabel} />
              <SummaryRow label={messages.heading} value={heading} />
              <SummaryRow
                label={messages.body}
                value={body}
                multiline
              />
              <SummaryRow label={messages.image} value={imageLabel} />
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 py-2 last:border-b-0">
                <span className="shrink-0 text-sm text-neutral-500">
                  {messages.ctaLink}
                </span>
                {ctaLink.trim() ? (
                  <code className="rounded bg-neutral-100 px-2 py-1 font-mono text-xs text-neutral-950">
                    {ctaLink.trim()}
                  </code>
                ) : (
                  <span className="text-sm font-medium text-neutral-950">
                    {messages.none}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 rounded-[10px] border border-neutral-200 bg-white p-4 shadow-sm">
            <input
              id="confirm-send"
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 rounded border-neutral-300 accent-[#a74cff]"
            />
            <label
              htmlFor="confirm-send"
              className="text-sm font-medium text-neutral-900"
            >
              {messages.confirmLabel}
            </label>
          </div>

          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}

          <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              className="justify-start px-0 sm:px-2"
              disabled={pending !== null}
              onClick={handleSaveDraft}
            >
              {pending === 'draft' ? messages.savingDraft : messages.saveDraft}
            </Button>
            <div className="flex flex-wrap gap-3 sm:justify-end">
              <Button
                variant="outline"
                disabled={pending !== null}
                onClick={() => router.push('/announcements/new')}
              >
                {messages.backToEdit}
              </Button>
              <Button
                disabled={!confirmed || pending !== null}
                onClick={handleSend}
                className="bg-[#e7000b] text-white hover:bg-[#c60009] dark:bg-[#e7000b] dark:hover:bg-[#c60009]"
              >
                <Send className="mr-2 size-4" />
                {pending === 'send' ? messages.sending : messages.sendNow}
              </Button>
            </div>
          </div>
        </div>

        <div className="sticky top-10">
          <NotificationPreview
            heading={heading}
            body={body}
            imageUrl={previewImageUrl}
          />
        </div>
      </div>
    </div>
  )
}
