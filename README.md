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
   | `AMPLITUDE_API_KEY` | No | Enables server-side staff action analytics (see **Dashboard analytics** below) |
   | `AMPLITUDE_SECRET_KEY` | For engagement cron | With `AMPLITUDE_API_KEY`, used for Amplitude Dashboard REST API (read metrics) |
   | `CRON_SECRET` | For Vercel Cron | Secures `GET /api/cron/sync-amplitude-engagement` (`Authorization: Bearer …`) |

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

## Engagement stats (planned)

Columns like **open rate** and **CTA click rate** are intended to be filled after send (e.g. from **Amplitude**). For Audius, **tap on the push = opening the CTA** — treat as **one metric** when instrumenting and when backfilling; the UI may show both labels for now but they can share the same underlying event/count.

**Amplitude join key:** On send, the dashboard passes Supabase `announcements.id` as **`dashboard_announcement_id`** in the notifications service / push **payload** (snake_case JSON). Clients should send **Amplitude** event properties as **`dashboardAnnouncementId`** (camelCase) so they match other metrics (`link_to`, `kind`, etc.). The engagement cron sums both `dashboardAnnouncementId` and legacy `dashboard_announcement_id` on those events so older data still counts.

### Dashboard analytics (server)

Set **`AMPLITUDE_API_KEY`** so API routes send staff actions to Amplitude via the [HTTP API](https://www.docs.developers.amplitude.com/analytics/apis/http-v2-api/). **`user_id`** is the staff member’s Google **email** (`@audius.co` / `@audius.org`). Events are scheduled with Next.js `after()` so responses are not blocked.

| Event | When | Key properties |
|-------|------|----------------|
| `Notifications Dashboard: Log In` | Successful Google sign-in | `auth_provider` |
| `Notifications Dashboard: Announcement Created` | `POST /api/announcements` | `dashboardAnnouncementId`, `status`, `audience_size`, `has_image`, `has_cta_link`, … |
| `Notifications Dashboard: Announcement Updated` | `PATCH /api/announcements/[id]` | `dashboardAnnouncementId`, `updated_fields`, `updated_field_count` |
| `Notifications Dashboard: Announcement Deleted` | `DELETE /api/announcements/[id]` | `dashboardAnnouncementId` |
| `Notifications Dashboard: Announcement Send Success` | Send completed | `dashboardAnnouncementId`, `recipient_count`, `sent_count` |
| `Notifications Dashboard: Announcement Send Failure` | Send errored | `dashboardAnnouncementId`, `recipient_count`, `error_message` |
| `Notifications Dashboard: Automated Trigger Updated` | `PATCH /api/automated/[id]` | `automated_trigger_id`, `updated_fields`, … |

If `AMPLITUDE_API_KEY` is unset, tracking is a no-op.

### Amplitude engagement sync (Vercel Cron)

Hourly cron (`vercel.json`) calls **`GET /api/cron/sync-amplitude-engagement`**, which:

1. Authenticates with **`Authorization: Bearer ${CRON_SECRET}`** (set `CRON_SECRET` in Vercel — [securing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)).
2. Uses **Amplitude Dashboard REST API** (`/api/2/events/segmentation`) with **`AMPLITUDE_API_KEY` + `AMPLITUDE_SECRET_KEY`** (Basic auth) to count:
   - **`Notifications: Open Push Notification`** with `dashboardAnnouncementId` or legacy `dashboard_announcement_id` → `funnel_opened`
   - **`Notifications: Clicked Tile`** with `kind` = `announcement` and `dashboardAnnouncementId` or legacy `dashboard_announcement_id` → `funnel_clicked` / `cta_clicks`
3. Writes **`open_rate`** / **`cta_click_rate`** vs **`funnel_sent`**, and **`amplitude_engagement_synced_at`**.

**Supabase:** run the migration for `amplitude_engagement_synced_at` if your table predates it (see `schema.sql` comment).

**Schedule:** edit `vercel.json` (`schedule` is cron syntax; default is hourly `0 * * * *`).

**UI:** Sent announcement detail and the announcements table show **last synced** time; use **Sync metrics** on the detail page to run the same job immediately (requires signed-in staff session).

**Troubleshooting (400 “Invalid event property”):** Amplitude’s segmentation API only allows filtering on an event property **after at least one real event** has been ingested with that property for that event type. Defining the property in the UI/schema is not enough. Send a test **Notifications: Open Push Notification** (or tile click) that includes `dashboardAnnouncementId` / `dashboard_announcement_id`, or rely on `dashboard_announcement_id` until mobile/web traffic includes the new key. The sync job skips unknown properties and still sums the other key.

**Disable rate** can come from **Identity** (notification settings) / SNS endpoint churn when you wire it up.

## Env reference

See `.env.example`. Push delivery is done by the pedalboard notifications service. Announcement image uploads use **Supabase Storage** only. Amplitude and AWS entries in `.env.example` are optional / future use.
