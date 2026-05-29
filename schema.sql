-- Notifications Dashboard Schema
-- Run this in Supabase SQL Editor

-- Announcements: one-off push notifications sent to targeted user lists
CREATE TABLE announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  internal_label TEXT NOT NULL,
  heading TEXT NOT NULL CHECK (char_length(heading) <= 30),
  body TEXT NOT NULL CHECK (char_length(body) <= 120),
  image_url TEXT,
  cta_link TEXT,
  audience_csv_url TEXT,
  audience_csv_filename TEXT,
  audience_size INTEGER DEFAULT 0,
  invalid_rows INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'sending', 'sent', 'failed')),
  created_by TEXT NOT NULL,
  sent_at TIMESTAMPTZ,

  -- Delivery stats (populated post-send via SNS; opens synced from Discovery)
  -- open_* vs cta_*: separate columns for layout; CTA may be filled manually or future pipeline.
  recipients_reached INTEGER,
  delivery_rate NUMERIC(5,2),
  open_rate NUMERIC(5,2),
  unique_opens INTEGER,
  cta_click_rate NUMERIC(5,2),
  cta_clicks INTEGER,
  retention_uplift NUMERIC(5,2),
  disable_rate NUMERIC(5,2),
  disables INTEGER,

  -- Downstream actions (optional / future pipeline)
  play_starts INTEGER,
  play_starts_vs_avg NUMERIC(5,2),
  avg_session_length_seconds INTEGER,
  session_length_vs_avg TEXT,
  playlist_creates INTEGER,

  -- Delivery funnel raw counts (opens = tap-to-open; no separate "clicked" step)
  funnel_sent INTEGER,
  funnel_delivered INTEGER,
  funnel_opened INTEGER,

  -- Email funnel raw counts (from SendGrid Event Webhook, keyed by custom_args.announcement_id).
  -- Denominator for email rates is `email_sent` (actual SendGrid `processed` events),
  -- NOT audience_size — only users with email_frequency='live' receive an announcement email.
  -- Open rate is intentionally not aggregated: Apple Mail Privacy Protection pre-fetches
  -- tracking pixels for ~50% of traffic, so the metric is noise. Raw `open` events are
  -- still captured in email_events for optional debugging; click rate is the real signal.
  email_sent INTEGER,
  email_delivered INTEGER,
  email_clicked INTEGER,
  email_bounced INTEGER,
  email_unsubscribed INTEGER,
  email_spam_reported INTEGER,
  email_metrics_synced_at TIMESTAMPTZ,

  -- Last successful sync of open metrics from Discovery (Vercel cron or manual)
  engagement_metrics_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recipient user IDs for announcements (parsed from CSV at upload time)
CREATE TABLE announcement_recipients (
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX idx_announcement_recipients_announcement ON announcement_recipients(announcement_id);

-- Automated triggers: recurring push notifications fired by user behavior
CREATE TABLE automated_triggers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_condition TEXT NOT NULL,
  trigger_hours INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  heading TEXT NOT NULL CHECK (char_length(heading) <= 30),
  body TEXT NOT NULL CHECK (char_length(body) <= 120),
  image_url TEXT,
  cta_link TEXT,

  -- Rolling 30-day stats (populated by cron via trigger_sends + Discovery open API)
  audience_reached_30d INTEGER,
  open_rate_30d NUMERIC(5,2),

  -- Populated when a measurement pipeline exists (not currently computed)
  -- retention_uplift, disable_rate, return_day_1/7, churn_prevention: removed

  last_updated_by TEXT,
  engagement_metrics_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raw SendGrid Event Webhook log: one row per event, deduped on sg_event_id.
-- Aggregated into announcements.email_* columns by the hourly cron.
-- `user_id` stored as TEXT because SendGrid custom_args are strings; cast at read.
CREATE TABLE email_events (
  sg_event_id TEXT PRIMARY KEY,
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  user_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'processed', 'delivered', 'open', 'click',
    'bounce', 'dropped', 'deferred', 'spamreport',
    'unsubscribe', 'group_unsubscribe', 'group_resubscribe'
  )),
  url TEXT,
  sg_message_id TEXT,
  reason TEXT,
  user_agent TEXT,
  ip TEXT,
  ts TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_events_announcement_event ON email_events(announcement_id, event_type);
CREATE INDEX idx_email_events_click_url ON email_events(announcement_id, url) WHERE event_type = 'click';
CREATE INDEX idx_email_events_ts ON email_events(ts DESC);

-- RLS enabled immediately; no policies means anon/authenticated keys get no access.
-- Webhook + cron access via service role key, which bypasses RLS by design.
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- Historical performance data points for charting
CREATE TABLE trigger_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_id UUID NOT NULL REFERENCES automated_triggers(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  audience_reached INTEGER NOT NULL DEFAULT 0,
  actual_opens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trigger_performance_trigger ON trigger_performance(trigger_id);

-- Per-user send log for automated triggers. Used to compute audience_reached_30d
-- and as the denominator for open rate. Logged by the notification sender at
-- send time, keyed by (trigger_id, user_id, sent_at) to allow re-sends after
-- long gaps without deduplication false-positives.
CREATE TABLE trigger_sends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_id UUID NOT NULL REFERENCES automated_triggers(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trigger_sends_trigger_sent ON trigger_sends(trigger_id, sent_at DESC);
CREATE INDEX idx_trigger_sends_user ON trigger_sends(user_id);

ALTER TABLE trigger_sends ENABLE ROW LEVEL SECURITY;

-- Existing databases: add trigger_sends table and drop removed columns
-- ALTER TABLE automated_triggers DROP COLUMN IF EXISTS audience_reached_vs_last;
-- ALTER TABLE automated_triggers DROP COLUMN IF EXISTS open_rate_vs_avg;
-- ALTER TABLE automated_triggers DROP COLUMN IF EXISTS retention_uplift;
-- ALTER TABLE automated_triggers DROP COLUMN IF EXISTS retention_uplift_sig;
-- ALTER TABLE automated_triggers DROP COLUMN IF EXISTS disable_rate;
-- ALTER TABLE automated_triggers DROP COLUMN IF EXISTS disables_30d;
-- ALTER TABLE automated_triggers DROP COLUMN IF EXISTS return_day_1;
-- ALTER TABLE automated_triggers DROP COLUMN IF EXISTS return_day_1_vs_control;
-- ALTER TABLE automated_triggers DROP COLUMN IF EXISTS return_day_7;
-- ALTER TABLE automated_triggers DROP COLUMN IF EXISTS return_day_7_vs_control;
-- ALTER TABLE automated_triggers DROP COLUMN IF EXISTS churn_prevention;
-- ALTER TABLE automated_triggers DROP COLUMN IF EXISTS churn_prevention_label;
-- ALTER TABLE automated_triggers ADD COLUMN IF NOT EXISTS engagement_metrics_synced_at TIMESTAMPTZ;
-- Then run the CREATE TABLE trigger_sends + its indexes above.

CREATE INDEX idx_announcements_status ON announcements(status);
CREATE INDEX idx_announcements_created ON announcements(created_at DESC);

-- Existing databases: heading max was 40; to align with app (30 chars), drop the old
-- CHECK constraints (names from `\d announcements` / `\d automated_triggers`) and add:
--   ALTER TABLE announcements ADD CONSTRAINT announcements_heading_len
--     CHECK (char_length(heading) <= 30);
--   ALTER TABLE automated_triggers ADD CONSTRAINT automated_triggers_heading_len
--     CHECK (char_length(heading) <= 30);
-- Shorten any headings longer than 30 characters before tightening constraints.

-- Existing projects: add or rename engagement sync column
-- ALTER TABLE announcements ADD COLUMN IF NOT EXISTS engagement_metrics_synced_at TIMESTAMPTZ;
-- If you previously had amplitude_engagement_synced_at:
-- ALTER TABLE announcements RENAME COLUMN amplitude_engagement_synced_at TO engagement_metrics_synced_at;
-- Removed funnel_clicked (same as opens for push metrics):
-- ALTER TABLE announcements DROP COLUMN IF EXISTS funnel_clicked;

-- Existing projects: add email tracking columns + email_events table
-- ALTER TABLE announcements ADD COLUMN IF NOT EXISTS email_sent INTEGER;
-- ALTER TABLE announcements ADD COLUMN IF NOT EXISTS email_delivered INTEGER;
-- ALTER TABLE announcements ADD COLUMN IF NOT EXISTS email_clicked INTEGER;
-- ALTER TABLE announcements ADD COLUMN IF NOT EXISTS email_bounced INTEGER;
-- ALTER TABLE announcements ADD COLUMN IF NOT EXISTS email_unsubscribed INTEGER;
-- ALTER TABLE announcements ADD COLUMN IF NOT EXISTS email_spam_reported INTEGER;
-- ALTER TABLE announcements ADD COLUMN IF NOT EXISTS email_metrics_synced_at TIMESTAMPTZ;
-- Then run the CREATE TABLE email_events + its three indexes above.
-- If you previously added email_opened during an earlier rollout, drop it:
-- ALTER TABLE announcements DROP COLUMN IF EXISTS email_opened;

-- Enable RLS (service role bypasses); email_events is enabled inline at creation above.
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trigger_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_recipients ENABLE ROW LEVEL SECURITY;

-- Seed automated triggers (stats columns left NULL; populated by cron after real sends)
INSERT INTO automated_triggers (name, trigger_condition, trigger_hours, heading, body, is_active, last_updated_by)
VALUES
  ('3-day inactivity', 'User has not opened app for 72 hours', 72,
   'We saved something for you 👀', 'Come back and see what is new since your last session.', true, 'Michael'),
  ('7-day inactivity', 'User has not opened app for 168 hours', 168,
   'Your feed has new picks 💎', 'Artists and tracks you may like are waiting.', true, 'Ciara'),
  ('30-day inactivity', 'User has not opened app for 720 hours', 720,
   'It''s been a while', 'Return to discover new music and pick up where you left off.', true, 'Julian');

-- Seed some announcements
INSERT INTO announcements (
  internal_label, heading, body, cta_link, status, created_by, sent_at,
  audience_size, recipients_reached, delivery_rate, open_rate, unique_opens,
  cta_click_rate, cta_clicks, retention_uplift, disable_rate, disables,
  play_starts, play_starts_vs_avg, avg_session_length_seconds, session_length_vs_avg, playlist_creates,
  funnel_sent, funnel_delivered, funnel_opened,
  audience_csv_filename
) VALUES
  ('Spring Engagement Push', 'New music is waiting for you 🎵', 'Jump back in and hear fresh tracks picked for your taste.',
   'app://discover', 'sent', 'Julian', '2026-03-10T12:00:00Z',
   45120, 44800, 99.20, 38.00, 17024,
   12.00, 5414, 4.20, 0.20, 89,
   12450, 14.00, 860, '+2m vs avg', 892,
   45120, 44800, 17024, 'spring_cohort_2026.csv'),
  ('March Newsletter', 'Draft saved yesterday', '',
   NULL, 'draft', 'Dylan', NULL,
   NULL, NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL),
  ('New Feature: Playlists', 'Build your ultimate mix 💎', 'Create, share, and discover playlists built by fans like you.',
   'app://playlists', 'sent', 'Marcus', '2026-02-28T15:00:00Z',
   112000, 110500, 98.70, 45.00, 49725,
   18.00, 19890, 6.10, 0.40, 448,
   8200, 8.00, 720, '+1m vs avg', 560,
   112000, 110500, 49725, NULL),
  ('Holiday Promo Code', 'Get 20% off your next month 🎁', 'Use code HOLIDAY25 for a special discount on Audius Premium.',
   'app://settings/premium', 'sent', 'Roneil', '2025-12-15T10:00:00Z',
   350000, 346500, 99.00, 52.00, 180180,
   25.00, 86625, 8.50, 1.10, 3850,
   15800, 12.00, 950, '+3m vs avg', 1200,
   350000, 346500, 180180, NULL),
  ('Q1 Winback Campaign', 'We missed you!', 'Come back and check out what is new on Audius this quarter.',
   'app://feed', 'ready', 'Ray', NULL,
   42500, NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, 'q1_winback_users.csv');
