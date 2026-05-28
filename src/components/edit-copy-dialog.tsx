'use client'

import { useState } from 'react'
import { Info, Smartphone } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  NOTIFICATION_BODY_MAX_LENGTH,
  NOTIFICATION_HEADING_MAX_LENGTH,
} from '@/lib/notificationCopyLimits'
import type { AutomatedTrigger } from '@/lib/supabase/types'

type Props = {
  trigger: AutomatedTrigger
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (updated: AutomatedTrigger) => void
}

function LivePreview({ heading, body }: { heading: string; body: string }) {
  const title = heading.trim() || 'Notification heading'
  const subtitle = body.trim() || 'Enter short description…'

  return (
    <div className="flex w-[280px] flex-col gap-4">
      <div className="flex items-center gap-2">
        <Smartphone className="size-4 text-neutral-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Live Preview
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-[0px_0px_0px_1px_#e5e5e5,0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-100/50 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <div className="flex size-5 items-center justify-center rounded-lg bg-neutral-900 text-[10px] font-bold text-white">
              A
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
              Audius
            </span>
          </div>
          <span className="text-[11px] text-neutral-400">now</span>
        </div>
        <div className="flex flex-col gap-1.5 px-4 pb-4 pt-4">
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
          <p className="text-[13px] leading-relaxed text-neutral-600">
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  )
}

export function EditCopyDialog({ trigger, open, onOpenChange, onSaved }: Props) {
  const [heading, setHeading] = useState(() =>
    trigger.heading.slice(0, NOTIFICATION_HEADING_MAX_LENGTH)
  )
  const [body, setBody] = useState(() =>
    trigger.body.slice(0, NOTIFICATION_BODY_MAX_LENGTH)
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/automated/${trigger.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heading, body }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const updated = await res.json()
      onSaved(updated)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="flex">
          {/* Form */}
          <div className="flex flex-1 flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <DialogTitle>Edit: {trigger.name}</DialogTitle>
              <p className="text-sm text-neutral-500">
                Trigger: {trigger.trigger_condition}
              </p>
            </div>

            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 size-4 shrink-0 text-blue-600" />
                <p className="text-sm text-blue-800">
                  These edits affect future sends only. Trigger timing is not
                  editable here.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-heading">Heading</Label>
                <span className="text-sm text-neutral-500">
                  {heading.length}/{NOTIFICATION_HEADING_MAX_LENGTH}
                </span>
              </div>
              <Input
                id="edit-heading"
                maxLength={NOTIFICATION_HEADING_MAX_LENGTH}
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-body">Body</Label>
                <span className="text-sm text-neutral-500">
                  {body.length}/{NOTIFICATION_BODY_MAX_LENGTH}
                </span>
              </div>
              <Textarea
                id="edit-body"
                maxLength={NOTIFICATION_BODY_MAX_LENGTH}
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                Save changes
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="flex w-[360px] flex-col items-center justify-center border-l border-neutral-200 bg-neutral-50 p-6">
            <LivePreview heading={heading} body={body} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
