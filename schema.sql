-- Notifications Dashboard Schema
-- Run this in Supabase SQL Editor

-- Announcements: one-off push notifications sent to targeted user lists
CREATE TABLE announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  internal_label TEXT NOT NULL,
  heading TEXT NOT NULL CHECK (char_length(heading) <= 40),
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

  -- Delivery stats (populated post-send via SNS / Amplitude)
  recipients_reached INTEGER,
  delivery_rate NUMERIC(5,2),
  open_rate NUMERIC(5,2),
  unique_opens INTEGER,
  cta_click_rate NUMERIC(5,2),
  cta_clicks INTEGER,
  retention_uplift NUMERIC(5,2),
  disable_rate NUMERIC(5,2),
  disables INTEGER,

  -- Downstream actions (from Amplitude, 24h post-notification)
  play_starts INTEGER,
  play_starts_vs_avg NUMERIC(5,2),
  avg_session_length_seconds INTEGER,
  session_length_vs_avg TEXT,
  playlist_creates INTEGER,

  -- Delivery funnel raw counts
  funnel_sent INTEGER,
  funnel_delivered INTEGER,
  funnel_opened INTEGER,
  funnel_clicked INTEGER,

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
  heading TEXT NOT NULL CHECK (char_length(heading) <= 40),
  body TEXT NOT NULL CHECK (char_length(body) <= 120),
  image_url TEXT,
  cta_link TEXT,

  -- Rolling 30-day stats
  audience_reached_30d INTEGER,
  audience_reached_vs_last TEXT,
  open_rate_30d NUMERIC(5,2),
  open_rate_vs_avg TEXT,
  retention_uplift NUMERIC(5,2),
  retention_uplift_sig TEXT,
  disable_rate NUMERIC(5,2),
  disables_30d INTEGER,

  -- Impact on session frequency
  return_day_1 NUMERIC(5,2),
  return_day_1_vs_control TEXT,
  return_day_7 NUMERIC(5,2),
  return_day_7_vs_control TEXT,
  churn_prevention INTEGER,
  churn_prevention_label TEXT,

  last_updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
CREATE INDEX idx_announcements_status ON announcements(status);
CREATE INDEX idx_announcements_created ON announcements(created_at DESC);

-- Enable RLS (service role bypasses)
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trigger_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_recipients ENABLE ROW LEVEL SECURITY;

-- Seed automated triggers
INSERT INTO automated_triggers (name, trigger_condition, trigger_hours, heading, body, is_active, last_updated_by,
  audience_reached_30d, audience_reached_vs_last, open_rate_30d, open_rate_vs_avg,
  retention_uplift, retention_uplift_sig, disable_rate, disables_30d,
  return_day_1, return_day_1_vs_control, return_day_7, return_day_7_vs_control,
  churn_prevention, churn_prevention_label
) VALUES
  ('3-day inactivity', 'User has not opened app for 72 hours', 72,
   'We saved something for you 👀', 'Come back and see what is new since your last session.', true, 'Michael',
   1400000, '+12% vs last mo', 28.00, '+2.1% vs avg',
   1.20, 'Stat sig (p<0.05)', 0.80, 2401,
   42.00, '+5% vs control', 18.00, '+2% vs control',
   4800, 'Users retained this month'),
  ('7-day inactivity', 'User has not opened app for 168 hours', 168,
   'Your feed has new picks 💎', 'Artists and tracks you may like are waiting.', true, 'Ciara',
   980000, '+8% vs last mo', 24.00, '+1.8% vs avg',
   0.90, 'Stat sig (p<0.05)', 1.10, 1876,
   35.00, '+3% vs control', 14.00, '+1% vs control',
   3200, 'Users retained this month'),
  ('30-day inactivity', 'User has not opened app for 720 hours', 720,
   'It has been a while', 'Return to discover new music and pick up where you left off.', true, 'Julian',
   450000, '+5% vs last mo', 18.00, '+0.9% vs avg',
   0.50, 'Not sig', 1.80, 3102,
   22.00, '+2% vs control', 8.00, '+0.5% vs control',
   1800, 'Users retained this month');

-- Seed trigger performance (6 months of data for 3-day inactivity)
INSERT INTO trigger_performance (trigger_id, month, audience_reached, actual_opens)
SELECT id, m.month, m.reached, m.opens
FROM automated_triggers, (VALUES
  ('Jan', 8500, 1800),
  ('Feb', 12000, 3200),
  ('Mar', 18000, 5400),
  ('Apr', 22000, 7200),
  ('May', 28000, 9800),
  ('Jun', 32000, 11200)
) AS m(month, reached, opens)
WHERE automated_triggers.name = '3-day inactivity';

-- Seed some announcements
INSERT INTO announcements (
  internal_label, heading, body, cta_link, status, created_by, sent_at,
  audience_size, recipients_reached, delivery_rate, open_rate, unique_opens,
  cta_click_rate, cta_clicks, retention_uplift, disable_rate, disables,
  play_starts, play_starts_vs_avg, avg_session_length_seconds, session_length_vs_avg, playlist_creates,
  funnel_sent, funnel_delivered, funnel_opened, funnel_clicked,
  audience_csv_filename
) VALUES
  ('Spring Engagement Push', 'New music is waiting for you 🎵', 'Jump back in and hear fresh tracks picked for your taste.',
   'app://discover', 'sent', 'Julian', '2026-03-10T12:00:00Z',
   45120, 44800, 99.20, 38.00, 17024,
   12.00, 5414, 4.20, 0.20, 89,
   12450, 14.00, 860, '+2m vs avg', 892,
   45120, 44800, 17024, 5414, 'spring_cohort_2026.csv'),
  ('March Newsletter', 'Draft saved yesterday', '',
   NULL, 'draft', 'Dylan', NULL,
   NULL, NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL),
  ('New Feature: Playlists', 'Build your ultimate mix 💎', 'Create, share, and discover playlists built by fans like you.',
   'app://playlists', 'sent', 'Marcus', '2026-02-28T15:00:00Z',
   112000, 110500, 98.70, 45.00, 49725,
   18.00, 19890, 6.10, 0.40, 448,
   8200, 8.00, 720, '+1m vs avg', 560,
   112000, 110500, 49725, 19890, NULL),
  ('Holiday Promo Code', 'Get 20% off your next month 🎁', 'Use code HOLIDAY25 for a special discount on Audius Premium.',
   'app://settings/premium', 'sent', 'Roneil', '2025-12-15T10:00:00Z',
   350000, 346500, 99.00, 52.00, 180180,
   25.00, 86625, 8.50, 1.10, 3850,
   15800, 12.00, 950, '+3m vs avg', 1200,
   350000, 346500, 180180, 86625, NULL),
  ('Q1 Winback Campaign', 'We missed you!', 'Come back and check out what is new on Audius this quarter.',
   'app://feed', 'ready', 'Ray', NULL,
   42500, NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, 'q1_winback_users.csv');
