/**
 * Amplitude Dashboard REST API — Event Segmentation
 * @see https://www.docs.developers.amplitude.com/analytics/apis/dashboard-rest-api/
 */

const DEFAULT_BASE = 'https://amplitude.com/api/2'

export type AmplitudeEventFilter = {
  subprop_type: 'event' | 'user'
  subprop_key: string
  subprop_op:
    | 'is'
    | 'is not'
    | 'contains'
    | 'does not contain'
    | 'less'
    | 'less or equal'
    | 'greater'
    | 'greater or equal'
    | 'set is'
    | 'set is not'
  subprop_value: string[]
}

export type AmplitudeSegmentationEvent = {
  event_type: string
  filters?: AmplitudeEventFilter[]
}

export type SegmentationMetric = 'totals' | 'uniques'

function getDashboardApiBase(): string {
  return (
    process.env.AMPLITUDE_DASHBOARD_API_BASE?.replace(/\/$/, '') ?? DEFAULT_BASE
  )
}

function getBasicAuthHeader(): string {
  const apiKey = process.env.AMPLITUDE_API_KEY
  const secretKey = process.env.AMPLITUDE_SECRET_KEY
  if (!apiKey?.trim() || !secretKey?.trim()) {
    throw new Error(
      'AMPLITUDE_API_KEY and AMPLITUDE_SECRET_KEY are required for Dashboard REST API'
    )
  }
  const token = Buffer.from(`${apiKey}:${secretKey}`, 'utf8').toString('base64')
  return `Basic ${token}`
}

/** Sum daily totals from Event Segmentation when m=totals (or uniques). */
export function sumSeriesValues(data: {
  series?: number[][]
}): number {
  const series = data.series
  if (!series?.length || !series[0]?.length) return 0
  return series[0].reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
}

export async function fetchEventSegmentation(
  params: {
    event: AmplitudeSegmentationEvent
    start: string
    end: string
    /** Default totals */
    m?: SegmentationMetric
  }
): Promise<{ sum: number; raw: unknown }> {
  const base = getDashboardApiBase()
  const url = new URL(`${base}/events/segmentation`)
  url.searchParams.set('e', JSON.stringify(params.event))
  url.searchParams.set('start', params.start)
  url.searchParams.set('end', params.end)
  url.searchParams.set('m', params.m ?? 'totals')

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: getBasicAuthHeader(),
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text) as { data?: { series?: number[][] } }
  } catch {
    throw new Error(
      `Amplitude segmentation: non-JSON response (${res.status}): ${text.slice(0, 200)}`
    )
  }

  if (!res.ok) {
    throw new Error(
      `Amplitude segmentation: ${res.status} ${text.slice(0, 500)}`
    )
  }

  const data = (json as { data?: { series?: number[][] } }).data
  const sum = sumSeriesValues({ series: data?.series })
  return { sum, raw: json }
}
