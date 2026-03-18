import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

type StatCardProps = {
  label: string
  value: string
  subtitle?: string
  subtitleColor?: 'green' | 'red' | 'muted'
  icon?: LucideIcon
}

export function StatCard({
  label,
  value,
  subtitle,
  subtitleColor = 'muted',
  icon: Icon,
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            {label}
          </span>
          {!Icon ? null : <Icon className="size-4 text-neutral-400" />}
        </div>
        <span className="text-3xl font-bold tracking-tight">{value}</span>
        {!subtitle ? null : (
          <span
            className={cn(
              'text-xs',
              subtitleColor === 'green' && 'text-green-600',
              subtitleColor === 'red' && 'text-red-500',
              subtitleColor === 'muted' && 'text-neutral-500'
            )}
          >
            {subtitle}
          </span>
        )}
      </CardContent>
    </Card>
  )
}
