'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type FunnelStep = {
  label: string
  value: number
}

type DeliveryFunnelProps = {
  steps: FunnelStep[]
}

export function DeliveryFunnel({ steps }: DeliveryFunnelProps) {
  const max = steps[0]?.value ?? 1

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery Funnel</CardTitle>
        <p className="text-sm text-neutral-500">
          Conversion from sent to engaged.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.map((step) => {
          const pct = max > 0 ? (step.value / max) * 100 : 0
          return (
            <div key={step.label} className="flex items-center gap-4">
              <span className="w-20 text-right text-sm text-neutral-500">
                {step.label}
              </span>
              <div className="relative h-8 flex-1 overflow-hidden rounded bg-neutral-100">
                <div
                  className="absolute inset-y-0 left-0 rounded bg-neutral-900 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
