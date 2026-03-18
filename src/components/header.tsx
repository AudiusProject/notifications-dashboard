import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export function Header() {
  return (
    <header className="flex h-16 items-center justify-end border-b bg-white px-8">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-neutral-900">
          Hello, Ciara
        </span>
        <Avatar className="size-8 border border-neutral-300">
          <AvatarFallback className="bg-neutral-200 text-xs font-semibold">
            CI
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
