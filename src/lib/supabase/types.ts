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

  /**
   * Email funnel (from SendGrid Event Webhook, keyed by custom_args.announcement_id).
   * Denominator for email rates is `email_sent`, NOT audience_size — only users with
   * email_frequency='live' receive an announcement email.
   * Open rate is intentionally omitted (Apple Mail pre-fetch makes it unreliable);
   * raw `open` events still land in the `email_events` table if ever needed.
   */
  email_sent: number | null
  email_delivered: number | null
  email_clicked: number | null
  email_bounced: number | null
  email_unsubscribed: number | null
  email_spam_reported: number | null
  email_metrics_synced_at: string | null

  /** Last successful sync of open metrics from Discovery (cron or manual). */
  engagement_metrics_synced_at: string | null

  created_at: string
  updated_at: string
}

/** Raw SendGrid Event Webhook event; one row per sg_event_id. */
export type EmailEvent = {
  sg_event_id: string
  announcement_id: string | null
  user_id: string | null
  event_type:
    | 'processed'
    | 'delivered'
    | 'open'
    | 'click'
    | 'bounce'
    | 'dropped'
    | 'deferred'
    | 'spamreport'
    | 'unsubscribe'
    | 'group_unsubscribe'
    | 'group_resubscribe'
  url: string | null
  sg_message_id: string | null
  reason: string | null
  user_agent: string | null
  ip: string | null
  ts: string
  received_at: string
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
        Relationships: []
      }
      automated_triggers: {
        Row: AutomatedTrigger
        Insert: Partial<AutomatedTrigger> & Pick<AutomatedTrigger, 'name' | 'trigger_condition' | 'trigger_hours' | 'heading' | 'body'>
        Update: Partial<AutomatedTrigger>
        Relationships: []
      }
      announcement_recipients: {
        Row: AnnouncementRecipient
        Insert: AnnouncementRecipient
        Update: Partial<AnnouncementRecipient>
        Relationships: []
      }
      trigger_performance: {
        Row: TriggerPerformance
        Insert: Partial<TriggerPerformance> & Pick<TriggerPerformance, 'trigger_id' | 'month'>
        Update: Partial<TriggerPerformance>
        Relationships: []
      }
      email_events: {
        Row: EmailEvent
        Insert: Omit<EmailEvent, 'received_at'> & Partial<Pick<EmailEvent, 'received_at'>>
        Update: Partial<EmailEvent>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
