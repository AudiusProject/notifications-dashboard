# Notifications Dashboard

Internal dashboard for managing Audius push notifications: announcements (one-off sends) and automated triggers. Uses Next.js, Supabase, and the pedalboard notifications service for sending via AWS SNS.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set env in `.env.local` (see `.env.example`).

**Required for send to work:** Supabase (schema + `uploads` bucket), `PEDALBOARD_NOTIFICATIONS_URL` pointing at the notifications service, and optionally `PEDALBOARD_NOTIFICATIONS_SECRET` if the service requires it.

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
   | `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only) |
   | `PEDALBOARD_NOTIFICATIONS_URL` | Yes | Notifications service URL, e.g. `https://notifications.audius.engineering` (no trailing slash) |
   | `PEDALBOARD_NOTIFICATIONS_SECRET` | If auth enabled | Same value as `ANNOUNCEMENT_SEND_SECRET` on the notifications service |

   Add them for **Production** (and Preview if you want the same behavior in PR previews).

4. **Deploy**  
   Trigger a deploy (e.g. push to the main branch or click **Redeploy**). The dashboard will be available at your Vercel URL.

5. **Supabase**  
   Ensure the same Supabase project has:
   - The full schema applied (including `announcements`, `announcement_recipients`, `automated_triggers`, etc.)
   - A storage bucket named `uploads` for CSV and image uploads.

## Env reference

See `.env.example`. The dashboard does **not** need AWS keys; sending is done by the pedalboard notifications service. Amplitude and AWS vars in `.env.example` are for future stats integration.
