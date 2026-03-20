import type { ReactNode } from 'react'

import { AnnouncementDraftProvider } from './announcement-draft-context'

export default function NewAnnouncementLayout({
  children,
}: {
  children: ReactNode
}) {
  return <AnnouncementDraftProvider>{children}</AnnouncementDraftProvider>
}
