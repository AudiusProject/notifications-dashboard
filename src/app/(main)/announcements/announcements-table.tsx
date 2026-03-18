'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal, Search } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Announcement } from '@/lib/supabase/types'

const statusVariant: Record<
  Announcement['status'],
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  sent: 'default',
  ready: 'outline',
  draft: 'secondary',
  sending: 'default',
  failed: 'destructive',
}

function formatNumber(n: number | null) {
  if (n == null) return '-'
  return n.toLocaleString()
}

function formatPct(n: number | null) {
  if (n == null) return '-'
  return `${n}%`
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatUplift(n: number | null) {
  if (n == null) return '-'
  const sign = n >= 0 ? '+' : ''
  return `↗ ${sign}${n}%`
}

type Props = { announcements: Announcement[] }

export function AnnouncementsTable({ announcements }: Props) {
  const [search, setSearch] = useState('')

  const filtered = announcements.filter(
    (a) =>
      a.internal_label.toLowerCase().includes(search.toLowerCase()) ||
      a.heading.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search notifications..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Notification</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Date Sent</TableHead>
              <TableHead className="text-right">Audience</TableHead>
              <TableHead className="text-right">Open Rate</TableHead>
              <TableHead className="text-right">CTA %</TableHead>
              <TableHead className="text-right">Ret. Uplift</TableHead>
              <TableHead className="text-right">Disable %</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.id} className="cursor-pointer hover:bg-neutral-50">
                <TableCell>
                  <Link
                    href={`/announcements/${a.id}`}
                    className="block"
                  >
                    <div className="font-medium">{a.internal_label}</div>
                    <div className="text-xs text-neutral-500">
                      ↩ {a.heading}
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-neutral-600">
                  {a.created_by}
                </TableCell>
                <TableCell className="text-neutral-600">
                  {formatDate(a.sent_at)}
                </TableCell>
                <TableCell className="text-right">
                  {formatNumber(a.audience_size)}
                </TableCell>
                <TableCell className="text-right">
                  {formatPct(a.open_rate)}
                </TableCell>
                <TableCell className="text-right">
                  {formatPct(a.cta_click_rate)}
                </TableCell>
                <TableCell className="text-right">
                  {a.retention_uplift != null ? (
                    <span className="text-green-600">
                      {formatUplift(a.retention_uplift)}
                    </span>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatPct(a.disable_rate)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[a.status]}>
                    {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted"
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Link href={`/announcements/${a.id}`}>
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>Duplicate</DropdownMenuItem>
                      {a.status === 'draft' ? (
                        <DropdownMenuItem className="text-red-600">
                          Delete
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
