'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Upload, LinkIcon, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NotificationPreview } from '@/components/notification-preview'

import { useAnnouncementDraft } from './announcement-draft-context'

const HEADING_MAX = 40
const BODY_MAX = 120

const messages = {
  title: 'Create Announcement',
  subtitle: 'Step 1: Compose content, audience, and targeting',
  continue: 'Continue to review',
  saving: 'Saving…',
  saveDraft: 'Save Draft',
}

export function AnnouncementForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    internalLabel,
    heading,
    body,
    ctaLink,
    csvFile,
    imageSource,
    imageFile,
    imageUrlInput,
    setDraft,
  } = useAnnouncementDraft()

  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateLoading, setDuplicateLoading] = useState(false)

  const duplicateSourceId = searchParams.get('duplicate')

  useEffect(() => {
    if (!duplicateSourceId) return

    let cancelled = false
    setDuplicateLoading(true)
    setError(null)

    ;(async () => {
      try {
        const res = await fetch(`/api/announcements/${duplicateSourceId}`)
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string
          }
          throw new Error(
            typeof data.error === 'string'
              ? data.error
              : 'Could not load announcement to duplicate'
          )
        }
        const data = (await res.json()) as {
          internal_label?: string
          heading?: string
          body?: string
          cta_link?: string | null
          image_url?: string | null
        }
        if (cancelled) return

        const imageUrl = data.image_url?.trim() ?? ''
        setDraft({
          internalLabel: `${data.internal_label ?? 'Announcement'} (copy)`,
          heading: data.heading ?? '',
          body: data.body ?? '',
          ctaLink: data.cta_link ?? '',
          csvFile: null,
          imageSource: imageUrl ? 'url' : 'upload',
          imageFile: null,
          imageUrlInput: imageUrl,
        })
        router.replace('/announcements/new', { scroll: false })
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to duplicate'
          )
        }
      } finally {
        if (!cancelled) setDuplicateLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [duplicateSourceId, router, setDraft])

  const canSaveDraft = Boolean(
    internalLabel.trim() && heading.trim() && body.trim()
  )
  const canContinueToReview = Boolean(canSaveDraft && csvFile)

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

  const handleSaveDraft = useCallback(async () => {
    setSaving(true)
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
      setSaving(false)
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

  const handleContinueToReview = useCallback(() => {
    if (!canContinueToReview) return
    router.push('/announcements/new/review')
  }, [canContinueToReview, router])

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
            {duplicateLoading
              ? 'Copying content from the selected announcement…'
              : messages.subtitle}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          {/* Content Card */}
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="label">Internal label</Label>
                <Input
                  id="label"
                  placeholder="Spring engagement push"
                  value={internalLabel}
                  onChange={(e) => setDraft({ internalLabel: e.target.value })}
                />
                <p className="text-xs text-neutral-500">
                  Not shown to end users.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="heading">Notification heading</Label>
                  <span className="text-sm text-neutral-500">
                    {heading.length}/{HEADING_MAX}
                  </span>
                </div>
                <Input
                  id="heading"
                  placeholder="New music is waiting for you 🎵"
                  maxLength={HEADING_MAX}
                  value={heading}
                  onChange={(e) => setDraft({ heading: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="body">Notification body</Label>
                  <span className="text-sm text-neutral-500">
                    {body.length}/{BODY_MAX}
                  </span>
                </div>
                <Textarea
                  id="body"
                  placeholder="Enter short description..."
                  maxLength={BODY_MAX}
                  rows={4}
                  value={body}
                  onChange={(e) => setDraft({ body: e.target.value })}
                />
              </div>

              <div className="space-y-3">
                <Label>Optional image</Label>
                <p className="text-xs text-neutral-500">
                  Rich push needs a public <span className="font-mono">https://</span>{' '}
                  URL. File uploads go to Supabase Storage (<span className="font-mono">uploads</span>{' '}
                  bucket, public).
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={imageSource === 'upload' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setDraft({ imageSource: 'upload', imageUrlInput: '' })
                    }}
                  >
                    Upload file
                  </Button>
                  <Button
                    type="button"
                    variant={imageSource === 'url' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setDraft({ imageSource: 'url', imageFile: null })
                    }}
                  >
                    Image URL
                  </Button>
                </div>
                {imageSource === 'upload' ? (
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-200 px-4 py-8 transition-colors hover:border-neutral-400">
                    <ImageIcon className="size-6 text-neutral-400" />
                    <span className="text-sm font-medium">
                      {imageFile?.name ?? 'Click to upload image'}
                    </span>
                    <span className="text-xs text-neutral-500">
                      JPEG, PNG, GIF, WebP up to 2MB
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={(e) =>
                        setDraft({ imageFile: e.target.files?.[0] ?? null })
                      }
                    />
                  </label>
                ) : (
                  <div className="space-y-2">
                    <Input
                      id="image-url"
                      placeholder="https://cdn.example.com/announcement.png"
                      className="font-mono text-sm"
                      value={imageUrlInput}
                      onChange={(e) => setDraft({ imageUrlInput: e.target.value })}
                    />
                    <p className="text-xs text-neutral-500">
                      Must be publicly reachable over HTTPS (no auth).
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cta">CTA Link (Deep link or URL)</Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="cta"
                    placeholder="app://discover"
                    className="pl-10"
                    value={ctaLink}
                    onChange={(e) => setDraft({ ctaLink: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audience Card */}
          <Card>
            <CardHeader>
              <CardTitle>Audience</CardTitle>
              <p className="text-sm text-neutral-500">
                Upload a CSV of targeted User IDs.
              </p>
            </CardHeader>
            <CardContent>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-neutral-200 px-4 py-10 transition-colors hover:border-neutral-400">
                <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100">
                  <Upload className="size-6 text-neutral-600" />
                </div>
                <span className="text-sm font-medium">
                  {csvFile?.name ?? 'Upload CSV of user IDs'}
                </span>
                <span className="text-xs text-neutral-500">
                  One ID per row, no headers required.
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) =>
                    setDraft({ csvFile: e.target.files?.[0] ?? null })
                  }
                />
              </label>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-3 border-t pt-6">
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : null}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                disabled={saving || !canSaveDraft}
                onClick={handleSaveDraft}
              >
                {saving ? messages.saving : messages.saveDraft}
              </Button>
              <Button
                disabled={!canContinueToReview || saving}
                onClick={handleContinueToReview}
              >
                {messages.continue}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Preview */}
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
