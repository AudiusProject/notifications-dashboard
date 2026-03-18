'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, LinkIcon, ImageIcon, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NotificationPreview } from '@/components/notification-preview'

const HEADING_MAX = 40
const BODY_MAX = 120

export function AnnouncementForm() {
  const router = useRouter()
  const [internalLabel, setInternalLabel] = useState('')
  const [heading, setHeading] = useState('')
  const [body, setBody] = useState('')
  const [ctaLink, setCtaLink] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSaveDraft = internalLabel.trim() && heading.trim() && body.trim()
  const canSend = canSaveDraft && csvFile

  const handleSaveDraft = useCallback(
    async () => {
      setSaving(true)
      setError(null)
      try {
        const formData = new FormData()
        formData.append('internal_label', internalLabel)
        formData.append('heading', heading)
        formData.append('body', body)
        formData.append('cta_link', ctaLink)
        formData.append('status', 'draft')
        formData.append('created_by', 'Ciara')
        if (csvFile) formData.append('csv', csvFile)
        if (imageFile) formData.append('image', imageFile)

        const res = await fetch('/api/announcements', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('Failed to save')
        router.push('/announcements')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      } finally {
        setSaving(false)
      }
    },
    [internalLabel, heading, body, ctaLink, csvFile, imageFile, router]
  )

  const handleSend = useCallback(
    async () => {
      if (!csvFile) return
      setSaving(true)
      setError(null)
      try {
        const formData = new FormData()
        formData.append('internal_label', internalLabel)
        formData.append('heading', heading)
        formData.append('body', body)
        formData.append('cta_link', ctaLink)
        formData.append('status', 'ready')
        formData.append('created_by', 'Ciara')
        formData.append('csv', csvFile)
        if (imageFile) formData.append('image', imageFile)

        const createRes = await fetch('/api/announcements', { method: 'POST', body: formData })
        if (!createRes.ok) throw new Error('Failed to save')
        const { id } = await createRes.json()

        const sendRes = await fetch(`/api/announcements/${id}/send`, { method: 'POST' })
        if (!sendRes.ok) {
          const data = await sendRes.json().catch(() => ({}))
          throw new Error(data.error ?? `Send failed (${sendRes.status})`)
        }

        router.push(`/announcements/${id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Send failed')
      } finally {
        setSaving(false)
      }
    },
    [internalLabel, heading, body, ctaLink, csvFile, imageFile, router]
  )

  return (
    <div className="p-10">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/announcements" />}>
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Create Announcement
          </h1>
          <p className="text-sm text-neutral-500">
            Compose content, set audience, and send
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
                  onChange={(e) => setInternalLabel(e.target.value)}
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
                  onChange={(e) => setHeading(e.target.value)}
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
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Optional image</Label>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-200 px-4 py-8 transition-colors hover:border-neutral-400">
                  <ImageIcon className="size-6 text-neutral-400" />
                  <span className="text-sm font-medium">
                    {imageFile?.name ?? 'Click to upload image'}
                  </span>
                  <span className="text-xs text-neutral-500">
                    JPG, PNG, GIF up to 2MB
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif"
                    className="hidden"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  />
                </label>
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
                    onChange={(e) => setCtaLink(e.target.value)}
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
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
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
                Save Draft
              </Button>
              <Button
                disabled={!canSend || saving}
                onClick={handleSend}
              >
                <Send className="mr-2 size-4" />
                {saving ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="sticky top-10">
          <NotificationPreview heading={heading} body={body} />
        </div>
      </div>
    </div>
  )
}
