import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/stat-card'
import { Bell, Users, TrendingUp, Zap } from 'lucide-react'

export default function OverviewPage() {
  return (
    <div className="p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-neutral-500">
          High-level push notification metrics across all channels.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-4 gap-4">
        <StatCard
          label="Total Notifications (30D)"
          value="12"
          subtitle="5 announcements, 3 automated"
          icon={Bell}
        />
        <StatCard
          label="Total Audience (30D)"
          value="2.4M"
          subtitle="+18% vs last month"
          subtitleColor="green"
          icon={Users}
        />
        <StatCard
          label="Avg Open Rate"
          value="31%"
          subtitle="+3.2% vs last month"
          subtitleColor="green"
          icon={TrendingUp}
        />
        <StatCard
          label="Active Triggers"
          value="3"
          subtitle="All healthy"
          icon={Zap}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500">
            This page will show cross-channel analytics, A/B test results, and
            aggregate push notification health metrics from AWS SNS and
            Amplitude.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
