'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { TriggerPerformance } from '@/lib/supabase/types'

type Props = { data: TriggerPerformance[] }

export function PerformanceChart({ data }: Props) {
  const chartData = data.map((d) => ({
    month: d.month,
    reached: d.audience_reached,
    opens: d.actual_opens,
  }))

  if (chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-400">
        No performance data yet.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="gradReached" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a3e635" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#a3e635" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradOpens" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: '#737373' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#737373' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()
          }
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e5e5e5',
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="reached"
          name="Audience Reached"
          stroke="#a3e635"
          fill="url(#gradReached)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="opens"
          name="Actual Opens"
          stroke="#2dd4bf"
          fill="url(#gradOpens)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
