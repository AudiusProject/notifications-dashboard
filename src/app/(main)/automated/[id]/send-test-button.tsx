'use client'

import { useState, useRef } from 'react'
import { FlaskConical, Upload, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = { triggerId: string; triggerName: string }

type Mode = 'paste' | 'csv'

type Result = { sent: number; trigger_name: string }

function parseUserIds(raw: string): number[] | string {
  const ids = raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))

  if (ids.some(isNaN)) return 'All values must be numeric user IDs.'
  if (ids.length === 0) return 'Enter at least one user ID.'
  if (ids.length > 100) return 'Maximum 100 user IDs per test send.'
  return ids
}

export function SendTestButton({ triggerId, triggerName }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('paste')
  const [pasteValue, setPasteValue] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetState() {
    setPasteValue('')
    setCsvFile(null)
    setError(null)
    setResult(null)
    setSending(false)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) resetState()
  }

  async function readCsvAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  async function handleSend() {
    setError(null)
    setResult(null)

    const raw =
      mode === 'csv' && csvFile
        ? await readCsvAsText(csvFile).catch((e) => {
            setError(e.message)
            return null
          })
        : pasteValue

    if (raw === null) return

    const parsed = parseUserIds(raw)
    if (typeof parsed === 'string') {
      setError(parsed)
      return
    }

    setSending(true)
    try {
      const res = await fetch(`/api/automated/${triggerId}/test-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: parsed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`)
        return
      }
      setResult(data as Result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const canSend =
    !sending && (mode === 'paste' ? pasteValue.trim().length > 0 : csvFile !== null)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FlaskConical className="mr-2 size-4" />
        Send Test
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col gap-5 p-1">
            <div>
              <DialogTitle>Send test notification</DialogTitle>
              <p className="mt-1 text-sm text-neutral-500">
                Sends <span className="font-medium">{triggerName}</span> copy to
                specific users, bypassing the inactivity check. Does not count
                toward audience metrics.
              </p>
            </div>

            {result ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle2 className="size-10 text-green-500" />
                <p className="text-center text-sm font-medium">
                  Sent to {result.sent} user{result.sent !== 1 ? 's' : ''}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetState}
                >
                  Send another
                </Button>
              </div>
            ) : (
              <>
                {/* Mode toggle */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === 'paste' ? 'default' : 'outline'}
                    onClick={() => { setMode('paste'); setCsvFile(null) }}
                  >
                    Paste IDs
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === 'csv' ? 'default' : 'outline'}
                    onClick={() => { setMode('csv'); setPasteValue('') }}
                  >
                    Upload CSV
                  </Button>
                </div>

                {mode === 'paste' ? (
                  <div className="space-y-2">
                    <Label htmlFor="test-user-ids">
                      User IDs{' '}
                      <span className="font-normal text-neutral-400">
                        (comma or newline separated, max 100)
                      </span>
                    </Label>
                    <Textarea
                      id="test-user-ids"
                      placeholder={'12345\n67890\n11111'}
                      rows={5}
                      value={pasteValue}
                      onChange={(e) => setPasteValue(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>CSV file</Label>
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-neutral-200 px-4 py-8 transition-colors hover:border-neutral-400">
                      <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100">
                        <Upload className="size-5 text-neutral-600" />
                      </div>
                      <span className="text-sm font-medium">
                        {csvFile?.name ?? 'Click to upload CSV'}
                      </span>
                      <span className="text-xs text-neutral-500">
                        One user ID per row, no headers. Max 100 IDs.
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv,text/plain"
                        className="hidden"
                        onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => handleOpenChange(false)}
                    disabled={sending}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSend} disabled={!canSend}>
                    {sending ? 'Sending…' : 'Send test'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
