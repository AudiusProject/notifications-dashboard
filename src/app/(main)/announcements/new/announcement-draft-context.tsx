'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AnnouncementDraftState = {
  internalLabel: string
  heading: string
  body: string
  ctaLink: string
  csvFile: File | null
  imageSource: 'upload' | 'url'
  imageFile: File | null
  imageUrlInput: string
}

const defaultState: AnnouncementDraftState = {
  internalLabel: '',
  heading: '',
  body: '',
  ctaLink: '',
  csvFile: null,
  imageSource: 'upload',
  imageFile: null,
  imageUrlInput: '',
}

type AnnouncementDraftContextValue = AnnouncementDraftState & {
  setDraft: (partial: Partial<AnnouncementDraftState>) => void
  resetDraft: () => void
}

const AnnouncementDraftContext =
  createContext<AnnouncementDraftContextValue | null>(null)

export function AnnouncementDraftProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AnnouncementDraftState>(defaultState)

  const setDraft = useCallback((partial: Partial<AnnouncementDraftState>) => {
    setState((s) => ({ ...s, ...partial }))
  }, [])

  const resetDraft = useCallback(() => {
    setState(defaultState)
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      setDraft,
      resetDraft,
    }),
    [state, setDraft, resetDraft]
  )

  return (
    <AnnouncementDraftContext.Provider value={value}>
      {children}
    </AnnouncementDraftContext.Provider>
  )
}

export function useAnnouncementDraft() {
  const ctx = useContext(AnnouncementDraftContext)
  if (!ctx) {
    throw new Error(
      'useAnnouncementDraft must be used within AnnouncementDraftProvider'
    )
  }
  return ctx
}
