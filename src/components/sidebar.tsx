'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Megaphone, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SHOW_AUTOMATED_NOTIFICATIONS_UI } from '@/lib/product-flags'

const nav = [
  { label: 'Overview', href: '/overview', icon: BarChart3 },
  { label: 'Announcements', href: '/announcements', icon: Megaphone },
  ...(SHOW_AUTOMATED_NOTIFICATIONS_UI
    ? [
        {
          label: 'Automated Notifications',
          href: '/automated',
          icon: Zap,
        } as const,
      ]
    : []),
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-white">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex size-7 items-center justify-center rounded-lg bg-neutral-900 text-[10px] font-bold text-white">
          A
        </div>
        <span className="text-lg font-semibold tracking-tight">
          Audius Notifier
        </span>
      </div>
      <nav className="flex flex-col gap-1 p-4">
        {nav.map(({ label, href, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
