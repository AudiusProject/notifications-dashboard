import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Zap, Clock, Users, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/stat-card'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { AutomatedTrigger, TriggerPerformance } from '@/lib/supabase/types'
import { PerformanceChart } from './performance-chart'
import { EditCopyButton } from './edit-copy-button'
import { SendTestButton } from './send-test-button'

type Props = { params: Promise<{ id: string }> }

function formatNumber(n: number | null) {
  if (n == null) return '-'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
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
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" nativeButton={false} render={<Link href="/automated" />}>
          <ArrowLeft className="mr-1 size-4" />
          Back to Automated
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100">
                <Zap className="size-5 text-amber-600" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                {trigger.name}
              </h1>
              <Badge
                variant="outline"
                className={
                  trigger.is_active
                    ? 'border-green-200 bg-green-50 uppercase tracking-wider text-green-700'
                    : 'uppercase tracking-wider'
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
          <div className="flex items-center gap-2">
            <SendTestButton triggerId={trigger.id} triggerName={trigger.name} />
            <EditCopyButton trigger={trigger} />
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        <StatCard
          label="30D Audience Reached"
          value={formatNumber(trigger.audience_reached_30d)}
          subtitle={trigger.engagement_metrics_synced_at
            ? `Synced ${new Date(trigger.engagement_metrics_synced_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : 'Not yet synced'}
          subtitleColor="green"
          icon={Users}
        />
        <StatCard
          label="Open Rate"
          value={trigger.open_rate_30d != null ? `${trigger.open_rate_30d}%` : '-'}
          subtitle="Lifetime opens / sends"
          subtitleColor="green"
          icon={Eye}
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

    </div>
  )
}
