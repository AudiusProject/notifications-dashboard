import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/stat-card'
import { fetchRecipientCountByAnnouncementId } from '@/lib/announcement-recipient-counts'
import {
  computeAnnouncementReachAndOpenRate,
  formatCompactNumber,
  formatPercent1dp,
  getThirtyDaysAgoIso,
} from '@/lib/overview-stats'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { formatEngagementSyncedAt } from '@/lib/utils'
import { Bell, Users, TrendingUp, Zap } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OverviewPage() {
  const supabase = getSupabaseAdmin()
  const since = getThirtyDaysAgoIso()

  const [
    { data: latestSyncRow },
    { data: announcements30d, error: annErr },
    { data: triggersRows, error: trigErr },
  ] = await Promise.all([
    supabase
      .from('announcements')
      .select('amplitude_engagement_synced_at')
      .not('amplitude_engagement_synced_at', 'is', null)
      .order('amplitude_engagement_synced_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('announcements')
      .select('id, unique_opens, funnel_opened, sent_at, status')
      .eq('status', 'sent')
      .not('sent_at', 'is', null)
      .gte('sent_at', since),
    supabase.from('automated_triggers').select('id, is_active'),
  ])

  const lastEngagementSync =
    latestSyncRow &&
    typeof latestSyncRow === 'object' &&
    latestSyncRow !== null &&
    'amplitude_engagement_synced_at' in latestSyncRow
      ? (latestSyncRow as { amplitude_engagement_synced_at: string | null })
          .amplitude_engagement_synced_at
      : null

  const ids = announcements30d?.map((a) => a.id) ?? []
  const recipientCountByAnnouncementId = await fetchRecipientCountByAnnouncementId(
    supabase,
    ids
  )

  const aggregateRows =
    announcements30d?.map((a) => ({
      id: a.id,
      unique_opens: a.unique_opens,
      funnel_opened: a.funnel_opened,
    })) ?? []

  const { audienceReachRecipientRows, openRatePercent } =
    computeAnnouncementReachAndOpenRate(
      aggregateRows,
      recipientCountByAnnouncementId
    )

  const announcementSends30d = announcements30d?.length ?? 0
  const activeTriggerCount =
    triggersRows?.filter((t) => t.is_active).length ?? 0
  const inactiveTriggerCount =
    triggersRows?.filter((t) => !t.is_active).length ?? 0

  const dataIssue =
    annErr != null || trigErr != null
      ? 'Some metrics could not be loaded. Check Supabase logs.'
      : null

  return (
    <div className="p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-neutral-500">
          Announcement metrics (last 30 days). Automated triggers are listed
          separately.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Latest Amplitude engagement sync:{' '}
          <span className="font-medium text-neutral-700">
            {formatEngagementSyncedAt(lastEngagementSync)}
          </span>
        </p>
        {dataIssue ? (
          <p className="mt-2 text-xs text-amber-700">{dataIssue}</p>
        ) : null}
      </div>

      <div className="mb-8 grid grid-cols-4 gap-4">
        <StatCard
          label="Announcement sends"
          value={String(announcementSends30d)}
          subtitle="Last 30 days"
          icon={Bell}
        />
        <StatCard
          label="Audience reach"
          value={
            audienceReachRecipientRows > 0
              ? formatCompactNumber(audienceReachRecipientRows)
              : '—'
          }
          subtitle={
            audienceReachRecipientRows > 0
              ? 'Last 30 days · from recipient list'
              : 'Recipients saved when a send uses your CSV'
          }
          icon={Users}
        />
        <StatCard
          label="Open rate"
          value={formatPercent1dp(openRatePercent)}
          subtitle="Last 30 days"
          icon={TrendingUp}
        />
        <StatCard
          label="Active triggers"
          value={String(activeTriggerCount)}
          subtitle={
            inactiveTriggerCount > 0
              ? `${inactiveTriggerCount} inactive`
              : 'Automated rules'
          }
          icon={Zap}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500">
            Cross-channel charts, A/B tests, and SNS health will layer on top
            of these aggregates.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
