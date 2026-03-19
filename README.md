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

## Env reference

See `.env.example`. Push delivery is done by the pedalboard notifications service. Announcement image uploads use **Supabase Storage** only. Amplitude and AWS entries in `.env.example` are optional / future use.
