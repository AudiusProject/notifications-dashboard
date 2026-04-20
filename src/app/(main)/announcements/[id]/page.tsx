import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Copy, Users, Eye, MousePointerClick } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/stat-card'
import { DeliveryFunnel } from '@/components/delivery-funnel'
import { TopClickedLinks } from '@/components/top-clicked-links'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { fetchTopClickedLinks } from '@/lib/engagement/syncEmailEngagement'
import { EngagementSyncControls } from './engagement-sync-controls'
import { SendAnnouncementButton } from './send-button'
import type { Announcement } from '@/lib/supabase/types'

/**
 * Percent of email_sent, rounded to 1 decimal; null when denominator is 0.
 * Note: open rate is intentionally NOT surfaced — Apple Mail Privacy Protection
 * pre-fetches tracking pixels and makes the metric noise. Click rate is the
 * trustworthy email signal.
 */
function computeEmailRate(numerator: number | null, denominator: number | null) {
  if (!denominator || denominator <= 0) return null
  if (numerator == null) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

type Props = { params: Promise<{ id: string }> }

function formatNumber(n: number | null) {
  if (n == null) return '-'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  return n.toLocaleString()
}

function formatPct(n: number | null) {
  if (n == null) return '-'
  return `${n}%`
}

function formatSessionLength(seconds: number | null) {
  if (seconds == null) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export default async function AnnouncementDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { data: announcement } = await supabase
    .from('announcements')
    .select('*')
    .eq('id', id)
    .single<Announcement>()

  if (!announcement) notFound()

  const a = announcement
  const topLinks =
    a.status === 'sent' ? await fetchTopClickedLinks(a.id) : []
  const emailClickRate = computeEmailRate(a.email_clicked, a.email_sent)
  const sentDate = a.sent_at
    ? new Date(a.sent_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <div className="p-10">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" render={<Link href="/announcements" />}>
          <ArrowLeft className="mr-1 size-4" />
          Back
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {a.internal_label}
              </h1>
              <Badge
                variant={a.status === 'sent' ? 'default' : 'secondary'}
              >
                {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
              </Badge>
            </div>
            {sentDate ? (
              <p className="mt-1 text-sm text-neutral-500">
                📅 Sent on {sentDate} by {a.created_by}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {a.status === 'ready' ? (
              <SendAnnouncementButton announcementId={a.id} />
            ) : null}
            <Button
              variant="outline"
              render={
                <Link href={`/announcements/new?duplicate=${a.id}`} />
              }
            >
              <Copy className="mr-2 size-4" />
              Duplicate
            </Button>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      {a.status === 'sent' ? (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-sm text-neutral-600">
              Open metrics sync from Discovery (hourly cron or manual refresh)
              when the Audius API metrics env vars are set.
            </p>
            <EngagementSyncControls
              announcementId={a.id}
              syncedAt={a.engagement_metrics_synced_at}
            />
          </div>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard
              label="Recipients Reached"
              value={formatNumber(a.recipients_reached)}
              subtitle={
                a.delivery_rate != null
                  ? `${a.delivery_rate}% delivery rate`
                  : undefined
              }
              icon={Users}
            />
            <StatCard
              label="Push Open Rate"
              value={formatPct(a.open_rate)}
              subtitle={
                a.unique_opens != null
                  ? `↗ ${formatNumber(a.unique_opens)} unique opens`
                  : undefined
              }
              subtitleColor="green"
              icon={Eye}
            />
            <StatCard
              label="Email Click Rate"
              value={emailClickRate != null ? `${emailClickRate}%` : '-'}
              subtitle={
                a.email_clicked != null
                  ? `${formatNumber(a.email_clicked)} unique clickers of ${formatNumber(a.email_sent)} sent`
                  : a.email_sent != null
                    ? `awaiting clicks (${formatNumber(a.email_sent)} sent)`
                    : 'awaiting SendGrid webhook'
              }
              subtitleColor="green"
              icon={MousePointerClick}
            />
          </div>

          {/* Delivery Funnel + Content Snapshot */}
          <div className="mb-8 grid grid-cols-[1fr_360px] gap-6">
            <DeliveryFunnel
              channels={[
                {
                  title: 'Push (AWS SNS)',
                  steps: [
                    { label: 'Sent', value: a.funnel_sent ?? 0 },
                    { label: 'Delivered', value: a.funnel_delivered ?? 0 },
                    { label: 'Opened', value: a.funnel_opened ?? 0 },
                  ],
                },
                {
                  title: 'Email (SendGrid)',
                  subtitle:
                    "Only users with email frequency = 'live' receive announcement emails. Open rate not shown — Apple Mail pre-fetch makes it unreliable; click rate is the real signal.",
                  barClassName: 'bg-blue-600',
                  steps: [
                    { label: 'Sent', value: a.email_sent ?? 0 },
                    { label: 'Delivered', value: a.email_delivered ?? 0 },
                    { label: 'Clicked', value: a.email_clicked ?? 0 },
                  ],
                },
              ]}
            />

            <Card>
              <CardHeader>
                <CardTitle>Content Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Heading
                  </span>
                  <p className="mt-1 font-medium">{a.heading}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Body
                  </span>
                  <p className="mt-1 text-sm text-neutral-600">{a.body}</p>
                </div>
                {a.cta_link ? (
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      CTA
                    </span>
                    <p className="mt-1 rounded bg-neutral-100 px-2 py-1 font-mono text-sm">
                      {a.cta_link}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Top Clicked Links (Email) */}
          <div className="mb-8">
            <TopClickedLinks rows={topLinks} />
          </div>

          {/* Downstream Actions + Audience */}
          <div className="grid grid-cols-[1fr_360px] gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Downstream Actions</CardTitle>
                <p className="text-sm text-neutral-500">
                  Activity tracked within 24 hours post-notification.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border p-4">
                    <span className="text-xs text-neutral-500">
                      Play Starts
                    </span>
                    <p className="mt-1 text-2xl font-bold">
                      {formatNumber(a.play_starts)}
                    </p>
                    {a.play_starts_vs_avg != null ? (
                      <span className="text-xs text-green-600">
                        ↗ +{a.play_starts_vs_avg}% vs avg
                      </span>
                    ) : null}
                  </div>
                  <div className="rounded-lg border p-4">
                    <span className="text-xs text-neutral-500">
                      Avg Session Length
                    </span>
                    <p className="mt-1 text-2xl font-bold">
                      {formatSessionLength(a.avg_session_length_seconds)}
                    </p>
                    {a.session_length_vs_avg ? (
                      <span className="text-xs text-green-600">
                        ↗ {a.session_length_vs_avg}
                      </span>
                    ) : null}
                  </div>
                  <div className="rounded-lg border p-4">
                    <span className="text-xs text-neutral-500">
                      Playlist Creates
                    </span>
                    <p className="mt-1 text-2xl font-bold">
                      {formatNumber(a.playlist_creates)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Audience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {a.audience_csv_filename ? (
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex size-10 items-center justify-center rounded bg-neutral-100">
                      📄
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {a.audience_csv_filename}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Uploaded list targeting
                      </p>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Audience size</span>
                  <span className="font-medium">
                    {formatNumber(a.audience_size)}
                  </span>
                </div>
                {a.invalid_rows > 0 ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">
                      Invalid rows excluded
                    </span>
                    <span className="font-medium">{a.invalid_rows}</span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-neutral-500">
              Stats will appear after this announcement has been sent.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
