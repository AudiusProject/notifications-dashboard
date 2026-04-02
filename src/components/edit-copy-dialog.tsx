'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { NotificationPreview } from '@/components/notification-preview'
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
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit: {trigger.name}</DialogTitle>
          <p className="text-sm text-neutral-500">
            Trigger: {trigger.trigger_condition}
          </p>
        </DialogHeader>

        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 size-4 text-blue-600" />
            <p className="text-sm text-blue-800">
              These edits affect future sends only. Trigger timing is not
              editable here.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-[1fr_340px]">
          <div className="space-y-4">
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
          </div>

          <div className="flex flex-col items-center">
            <NotificationPreview
              heading={heading}
              body={body}
              imageUrl={trigger.image_url}
            />
          </div>
        </div>

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
