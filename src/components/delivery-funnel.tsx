'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type FunnelStep = {
  label: string
  value: number
}

type FunnelChannel = {
  title: string
  /** Optional subtitle, e.g. "Only users on 'live' email frequency." */
  subtitle?: string
  steps: FunnelStep[]
  /** Tailwind bg class for the bar fill. Defaults to `bg-neutral-900`. */
  barClassName?: string
}

type DeliveryFunnelProps =
  | { steps: FunnelStep[]; channels?: never }
  | { channels: FunnelChannel[]; steps?: never }

function FunnelBars({
  steps,
  barClassName = 'bg-neutral-900',
}: {
  steps: FunnelStep[]
  barClassName?: string
}) {
  const max = steps[0]?.value ?? 1
  return (
    <div className="space-y-4">
      {steps.map((step) => {
        const pct = max > 0 ? (step.value / max) * 100 : 0
        return (
          <div key={step.label} className="flex items-center gap-4">
            <span className="w-20 text-right text-sm text-neutral-500">
              {step.label}
            </span>
            <div className="relative h-8 flex-1 overflow-hidden rounded bg-neutral-100">
              <div
                className={`absolute inset-y-0 left-0 rounded transition-all ${barClassName}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-16 text-right text-xs tabular-nums text-neutral-500">
              {step.value.toLocaleString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function DeliveryFunnel(props: DeliveryFunnelProps) {
  if ('channels' in props && props.channels) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Delivery Funnel</CardTitle>
          <p className="text-sm text-neutral-500">
            Conversion from sent to engaged, by channel.
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          {props.channels.map((channel) => (
            <div key={channel.title}>
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-neutral-900">
                  {channel.title}
                </h3>
                {channel.subtitle ? (
                  <p className="text-xs text-neutral-500">{channel.subtitle}</p>
                ) : null}
              </div>
              <FunnelBars
                steps={channel.steps}
                barClassName={channel.barClassName}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery Funnel</CardTitle>
        <p className="text-sm text-neutral-500">
          Conversion from sent to engaged.
        </p>
      </CardHeader>
      <CardContent>
        <FunnelBars steps={props.steps ?? []} />
      </CardContent>
    </Card>
  )
}
