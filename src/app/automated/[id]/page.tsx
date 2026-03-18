import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Zap, Clock, Users, Eye, TrendingUp, UserMinus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/stat-card'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { AutomatedTrigger, TriggerPerformance } from '@/lib/supabase/types'
import { PerformanceChart } from './performance-chart'
import { EditCopyButton } from './edit-copy-button'

type Props = { params: Promise<{ id: string }> }

function formatNumber(n: number | null) {
  if (n == null) return '-'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function formatPct(n: number | null) {
  if (n == null) return '-'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n}%`
}

export default async function TriggerDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = getSupabaseAdmin()

  const [{ data: trigger }, { data: performance }] = await Promise.all([
    supabase.from('automated_triggers').select('*').eq('id', id).single<AutomatedTrigger>(),
    supabase
      .from('trigger_performance')
      .select('*')
      .eq('trigger_id', id)
      .order('created_at', { ascending: true })
      .returns<TriggerPerformance[]>(),
  ])

  if (!trigger) notFound()

  return (
    <div className="p-10">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" render={<Link href="/automated" />}>
          <ArrowLeft className="mr-1 size-4" />
          Back to Automated
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-amber-50">
                <Zap className="size-4 text-amber-600" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                {trigger.name}
              </h1>
              <Badge
                variant={trigger.is_active ? 'default' : 'secondary'}
                className={
                  trigger.is_active
                    ? 'bg-green-100 text-green-800 hover:bg-green-100'
                    : ''
                }
              >
                {trigger.is_active ? 'Active' : 'Paused'}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-1 text-sm text-neutral-500">
              <Clock className="size-3.5" />
              Trigger: {trigger.trigger_condition}
            </div>
          </div>
          <EditCopyButton trigger={trigger} />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <StatCard
          label="30D Audience Reached"
          value={formatNumber(trigger.audience_reached_30d)}
          subtitle={trigger.audience_reached_vs_last ?? undefined}
          subtitleColor="green"
          icon={Users}
        />
        <StatCard
          label="30D Open Rate"
          value={trigger.open_rate_30d != null ? `${trigger.open_rate_30d}%` : '-'}
          subtitle={trigger.open_rate_vs_avg ?? undefined}
          subtitleColor="green"
          icon={Eye}
        />
        <StatCard
          label="Retention Uplift"
          value={formatPct(trigger.retention_uplift)}
          subtitle={trigger.retention_uplift_sig ?? undefined}
          subtitleColor="green"
          icon={TrendingUp}
        />
        <StatCard
          label="Disable Rate"
          value={trigger.disable_rate != null ? `${trigger.disable_rate}%` : '-'}
          subtitle={
            trigger.disables_30d != null
              ? `✕ ${formatNumber(trigger.disables_30d)} unsubscribes`
              : undefined
          }
          subtitleColor="red"
          icon={UserMinus}
        />
      </div>

      {/* Historical Performance + Current Content */}
      <div className="mb-8 grid grid-cols-[1fr_360px] gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Historical Performance</CardTitle>
            <p className="text-sm text-neutral-500">
              Audience reached vs actual opens over the past 6 months.
            </p>
          </CardHeader>
          <CardContent className="h-72">
            <PerformanceChart data={performance ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Content</CardTitle>
            <p className="text-sm text-neutral-500">
              Live copy sent to users
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Heading
              </span>
              <p className="mt-1 font-medium">{trigger.heading}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Body
              </span>
              <p className="mt-1 text-sm text-neutral-600">{trigger.body}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Last Updated
              </span>
              <p className="mt-1 text-sm text-neutral-600">
                {new Date(trigger.updated_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                by {trigger.last_updated_by ?? 'Unknown'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Impact on Session Frequency */}
      <Card>
        <CardHeader>
          <CardTitle>Impact on Session Frequency</CardTitle>
          <p className="text-sm text-neutral-500">
            Post-notification engagement from target cohort
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <span className="text-xs text-neutral-500">Return Day 1</span>
              <p className="mt-1 text-2xl font-bold">
                {trigger.return_day_1 != null ? `${trigger.return_day_1}%` : '-'}
              </p>
              {trigger.return_day_1_vs_control ? (
                <span className="text-xs text-green-600">
                  ↗ {trigger.return_day_1_vs_control}
                </span>
              ) : null}
            </div>
            <div className="rounded-lg border p-4">
              <span className="text-xs text-neutral-500">Return Day 7</span>
              <p className="mt-1 text-2xl font-bold">
                {trigger.return_day_7 != null ? `${trigger.return_day_7}%` : '-'}
              </p>
              {trigger.return_day_7_vs_control ? (
                <span className="text-xs text-green-600">
                  ↗ {trigger.return_day_7_vs_control}
                </span>
              ) : null}
            </div>
            <div className="rounded-lg border p-4">
              <span className="text-xs text-neutral-500">Churn Prevention</span>
              <p className="mt-1 text-2xl font-bold">
                {formatNumber(trigger.churn_prevention)}
              </p>
              {trigger.churn_prevention_label ? (
                <span className="text-xs text-neutral-500">
                  {trigger.churn_prevention_label}
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
