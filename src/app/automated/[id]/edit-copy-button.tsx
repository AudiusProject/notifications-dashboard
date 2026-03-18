'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EditCopyDialog } from '@/components/edit-copy-dialog'
import type { AutomatedTrigger } from '@/lib/supabase/types'

type Props = { trigger: AutomatedTrigger }

export function EditCopyButton({ trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Pencil className="mr-2 size-4" />
        Edit Copy
      </Button>
      {open ? (
        <EditCopyDialog
          trigger={trigger}
          open={open}
          onOpenChange={setOpen}
          onSaved={() => {
            setOpen(false)
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}
