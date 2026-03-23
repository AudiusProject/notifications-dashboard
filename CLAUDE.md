# Notifications Dashboard

Internal tool for managing Audius push notifications: one-off announcements and automated re-engagement triggers.

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript (strict)
- **Auth/DB/Storage:** Supabase (PostgreSQL, Storage for CSV/images)
- **State:** Zustand (future)
- **Styling:** Tailwind CSS v4, shadcn/ui (neutral base)
- **Charts:** Recharts (area chart for historical performance)
- **Deploy:** Vercel

## Commands

```bash
npm run dev     # Dev server (localhost:3000)
npm run build   # Production build
npm run lint    # ESLint
```

## Architecture

- **Pages:**
  - `/overview` — High-level metrics dashboard
  - `/announcements` — List of all announcement notifications with stats table
  - `/announcements/new` — Create announcement with content form + CSV audience upload + live preview
  - `/announcements/[id]` — Detail view: delivery funnel, downstream actions, content snapshot
  - `/automated` — List of automated trigger cards (inactivity-based)
  - `/automated/[id]` — Trigger detail: historical performance chart, impact metrics, current content

- **API Routes:**
  - `POST /api/announcements` — Create announcement (FormData: fields + CSV + image)
  - `GET/PATCH/DELETE /api/announcements/[id]` — CRUD operations
  - `GET/PATCH /api/automated/[id]` — Get trigger with performance data, update copy

- **Supabase:**
  - `schema.sql` — Run in Supabase SQL Editor. Seeds 3 automated triggers + 5 announcements.
  - `lib/supabase/admin.ts` — Service-role client (server-side, bypasses RLS)
  - `lib/supabase/server.ts` — SSR client with cookies
  - `lib/supabase/client.ts` — Browser client

- **Components:**
  - `sidebar.tsx` — App navigation
  - `header.tsx` — Top bar with user avatar
  - `stat-card.tsx` — Reusable metric card
  - `delivery-funnel.tsx` — Horizontal bar funnel chart
  - `notification-preview.tsx` — Mobile push notification preview
  - `edit-copy-dialog.tsx` — Modal for editing automated trigger copy

## Analytics (Amplitude)

- **Server-side** in API routes: `src/lib/analytics/track.ts` posts to Amplitude HTTP API when `AMPLITUDE_API_KEY` is set. Use `scheduleDashboardAnalytics()` (wraps `after()`). Event names live in `src/lib/analytics/events.ts`.
- **User id:** staff email from session (same as login).

## Amplitude read path (engagement)

- **Cron:** `vercel.json` → `GET /api/cron/sync-amplitude-engagement` (Bearer `CRON_SECRET`).
- **Implementation:** `src/lib/amplitude/segmentation.ts` (Dashboard REST Event Segmentation), `syncAnnouncementEngagement.ts`.
- **Env:** `AMPLITUDE_API_KEY`, `AMPLITUDE_SECRET_KEY`, optional `AMPLITUDE_DASHBOARD_API_BASE` for EU.

## Stats Sources

- **Delivery / Recipients:** AWS SNS delivery receipts
- **Open rate & CTA click rate:** For Audius we treat these as **the same user action** — tapping the announcement push applies the deep link / route (`open_rate` / `cta_click_rate` and funnel steps can be filled from **one** Amplitude event or the same count). The schema still has separate columns for layout flexibility; you may duplicate the value or collapse the UI later.
- **Retention Uplift:** Amplitude cohort analysis (7-day retention delta)
- **Disable Rate:** SNS endpoint disable events / identity DB
- **Downstream Actions:** Amplitude (play starts, session length, playlist creates)
- **Historical Performance:** Aggregated monthly in `trigger_performance` table

## Automated Notification Sender

The dashboard stores trigger configs. Actual sending is handled by a pedalboard app (`apps/notification-sender`) that:
1. Uses basekit `.tick()` to run on a schedule
2. Queries the discovery DB for users matching trigger conditions
3. Reads current heading/body from dashboard Supabase
4. Sends via AWS SNS

## Things You Must Not Do

- Do NOT commit `.env.local` or hardcode Supabase/AWS keys
- Do NOT send notifications directly from this dashboard — it manages configs only
- Do NOT modify `schema.sql` without checking all typed queries still compile

## Common Gotchas

- `schema.sql` must be run manually in Supabase SQL Editor before the app works
- Supabase Storage bucket "uploads" must be created via dashboard first
- Service role client bypasses RLS — use carefully
- Stats columns are nullable (populated async after send)

## Workflow

1. Read this file at session start
2. After features or fixes, run `npm run lint`
