export type Announcement = {
  id: string
  internal_label: string
  heading: string
  body: string
  image_url: string | null
  cta_link: string | null
  audience_csv_url: string | null
  audience_csv_filename: string | null
  audience_size: number
  invalid_rows: number
  status: 'draft' | 'ready' | 'sending' | 'sent' | 'failed'
  created_by: string
  sent_at: string | null

  recipients_reached: number | null
  delivery_rate: number | null
  open_rate: number | null
  unique_opens: number | null
  cta_click_rate: number | null
  cta_clicks: number | null
  retention_uplift: number | null
  disable_rate: number | null
  disables: number | null

  play_starts: number | null
  play_starts_vs_avg: number | null
  avg_session_length_seconds: number | null
  session_length_vs_avg: string | null
  playlist_creates: number | null

  funnel_sent: number | null
  funnel_delivered: number | null
  funnel_opened: number | null
  funnel_clicked: number | null

  /** Set by Vercel cron + Amplitude Dashboard API */
  amplitude_engagement_synced_at: string | null

  created_at: string
  updated_at: string
}

export type AutomatedTrigger = {
  id: string
  name: string
  trigger_condition: string
  trigger_hours: number
  is_active: boolean
  heading: string
  body: string
  image_url: string | null
  cta_link: string | null

  audience_reached_30d: number | null
  audience_reached_vs_last: string | null
  open_rate_30d: number | null
  open_rate_vs_avg: string | null
  retention_uplift: number | null
  retention_uplift_sig: string | null
  disable_rate: number | null
  disables_30d: number | null

  return_day_1: number | null
  return_day_1_vs_control: string | null
  return_day_7: number | null
  return_day_7_vs_control: string | null
  churn_prevention: number | null
  churn_prevention_label: string | null

  last_updated_by: string | null
  created_at: string
  updated_at: string
}

export type AnnouncementRecipient = {
  announcement_id: string
  user_id: number
}

export type TriggerPerformance = {
  id: string
  trigger_id: string
  month: string
  audience_reached: number
  actual_opens: number
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      announcements: {
        Row: Announcement
        Insert: Partial<Announcement> & Pick<Announcement, 'internal_label' | 'heading' | 'body' | 'created_by'>
        Update: Partial<Announcement>
      }
      automated_triggers: {
        Row: AutomatedTrigger
        Insert: Partial<AutomatedTrigger> & Pick<AutomatedTrigger, 'name' | 'trigger_condition' | 'trigger_hours' | 'heading' | 'body'>
        Update: Partial<AutomatedTrigger>
      }
      announcement_recipients: {
        Row: AnnouncementRecipient
        Insert: AnnouncementRecipient
        Update: Partial<AnnouncementRecipient>
      }
      trigger_performance: {
        Row: TriggerPerformance
        Insert: Partial<TriggerPerformance> & Pick<TriggerPerformance, 'trigger_id' | 'month'>
        Update: Partial<TriggerPerformance>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
