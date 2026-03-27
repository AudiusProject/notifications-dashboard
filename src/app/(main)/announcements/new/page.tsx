import { Suspense } from 'react'
import { AnnouncementForm } from './announcement-form'

export default function NewAnnouncementPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-sm text-neutral-500">Loading…</div>
      }
    >
      <AnnouncementForm />
    </Suspense>
  )
}
