'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

export function Header() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setEmail(data.email ?? null))
      .catch(() => setEmail(null))
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/login')
    router.refresh()
  }

  const initials = email
    ? email
        .split('@')[0]
        ?.slice(0, 2)
        .toUpperCase() ?? '?'
    : '…'

  return (
    <header className="flex h-16 items-center justify-end gap-4 border-b bg-white px-8">
      <span className="text-sm font-medium text-neutral-900">
        {email ? `Signed in as ${email}` : '…'}
      </span>
      <Avatar className="size-8 border border-neutral-300">
        <AvatarFallback className="bg-neutral-200 text-xs font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <Button
        variant="outline"
        size="sm"
        onClick={handleLogout}
        className="text-neutral-600"
      >
        Sign out
      </Button>
    </header>
  )
}
