# Notifications Dashboard

Internal dashboard for managing Audius push notifications: announcements (one-off sends) and automated triggers. Uses Next.js, Supabase, and the pedalboard notifications service for sending via AWS SNS.

## Local development

```bash
npm install
npm run dev
```


Open [http://localhost:3000](http://localhost:3000). Set env in `.env.local` (see `.env.example`).

**Access:** Only users who sign in with a Google account whose email ends with `@audius.co` or `@audius.org` can use the dashboard. Configure Google OAuth (see `.env.example`: `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `AUTH_SESSION_SECRET`).

**Required for send to work:** Supabase (schema + `uploads` bucket), `NOTIFICATIONS_SERVICE_URL` pointing at the notifications service, and optionally `ANNOUNCEMENT_SEND_SECRET` if the service requires it.

**Announcement images (rich push):** APNs/FCM need a **public `https://` URL**. In **Create Announcement** you can paste an image URL or upload a file. Uploads are stored in Supabase Storage (`uploads` bucket, e.g. under `images/announcements/…`) and must be **public** so push providers can fetch them.

## Deploy on Vercel

1. **Push the repo** to GitHub (or connect your existing repo in Vercel).

2. **Import in Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import the `notifications-dashboard` repo
   - Vercel will detect Next.js; leave **Build Command** as `npm run build` and **Output Directory** as default.

3. **Environment variables**  
   In the Vercel project → **Settings** → **Environment Variables**, add:

   | Variable | Required | Notes |
   |----------|----------|--------|
   | `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID (server-side verification) |
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Yes | Same Google OAuth client ID (client-side sign-in) |
   | `AUTH_SESSION_SECRET` | Yes | At least 32 characters; used to sign session JWT |
   | `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only) |
   | `NOTIFICATIONS_SERVICE_URL` | Yes | Notifications service URL, e.g. `https://notifications.audius.engineering` (no trailing slash) |
   | `ANNOUNCEMENT_SEND_SECRET` | If auth enabled | Same value as `ANNOUNCEMENT_SEND_SECRET` on the notifications service |
   | `AUDIUS_API_URL` | For push open metrics | e.g. `https://api.audius.co` (no trailing slash); used with `NOTIFICATION_CAMPAIGN_OPEN_METRICS_SECRET` |
   | `NOTIFICATION_CAMPAIGN_OPEN_METRICS_SECRET` | For push open metrics | Must match API env `notificationCampaignOpenMetricsSecret` |
   | `CRON_SECRET` | For Vercel Cron | Secures `GET /api/cron/sync-engagement` (`Authorization: Bearer …`) |

   Add them for **Production** (and Preview if you want the same behavior in PR previews).

4. **Deploy**  
   Trigger a deploy (e.g. push to the main branch or click **Redeploy**). The dashboard will be available at your Vercel URL.

5. **Supabase**  
   Ensure the same Supabase project has:
   - The full schema applied (including `announcements`, `announcement_recipients`, `automated_triggers`, etc.)
   - **Storage bucket `uploads`** (required for CSV + image uploads). If you see `{"error":"Bucket not found"}`, create it:
     1. Supabase dashboard → **Storage** → **New bucket**
     2. Name: **`uploads`**
     3. For rich push images, objects must be reachable at a public `https://` URL — either turn on **Public bucket**, or add policies so **public read** applies to `images/announcements/*` (and your app can upload with the service role key used server-side).

## Engagement stats

**Push opens (source of truth):** When **`AUDIUS_API_URL`** and **`NOTIFICATION_CAMPAIGN_OPEN_METRICS_SECRET`** are set, the engagement cron reads **distinct openers** from Discovery (`GET /v1/notifications/campaigns/:campaignId/opens`). Clients should call **`POST /v1/users/:userId/notifications/campaigns/:campaignId/open`** (authenticated as that user) when the user opens the push; `campaignId` is the internal send id (e.g. Supabase `announcements.id` UUID) included in the push payload.

**Rates:** **`open_rate`** is computed vs **`announcement_recipients`** row count (not `funnel_sent`). **`unique_opens`** and **`funnel_opened`** store the Discovery distinct-opener count.

**CTA / tile / downstream columns** (`cta_click_rate`, `funnel_clicked`, retention, etc.) remain in the schema for future use; the sync job does not populate them.

### Engagement sync (Vercel Cron)

Hourly cron (`vercel.json`) calls **`GET /api/cron/sync-engagement`**, which:

1. Authenticates with **`Authorization: Bearer ${CRON_SECRET}`** (set `CRON_SECRET` in Vercel — [securing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)).
2. Loads distinct open counts from the **Audius API** (Discovery) for recent sent announcements.
3. Writes **`open_rate`**, **`funnel_opened`**, **`unique_opens`**, and **`engagement_metrics_synced_at`**.

**Discovery:** Apply the API migration creating **`notification_campaign_push_open`** (see `api/sql/migrations/20260316_notification_campaign_push_open.sql` in the **api** repo). Set API env **`notificationCampaignOpenMetricsSecret`** to the same value as the dashboard’s **`NOTIFICATION_CAMPAIGN_OPEN_METRICS_SECRET`** (header **`X-Notification-Campaign-Metrics-Secret`** on the metrics `GET`).

**Supabase:** New installs use **`engagement_metrics_synced_at`** in `schema.sql`. If you previously had **`amplitude_engagement_synced_at`**, rename it (see `schema.sql` comment).

**Schedule:** edit `vercel.json` (`schedule` is cron syntax; default is hourly `0 * * * *`).

**UI:** Sent announcement detail and the announcements table show **last synced** time; use **Sync metrics** on the detail page to run the same job immediately (requires signed-in staff session).

**Disable rate** can come from **Identity** (notification settings) / SNS endpoint churn when you wire it up.

## Env reference

See `.env.example`. Push delivery is done by the pedalboard notifications service. Announcement image uploads use **Supabase Storage** only. AWS entries in `.env.example` are optional / future use.
