# LOOPEC

LOOPEC is a college-exclusive marketplace from CiGaRa Technologies, part of CiGaRa Group. A verified member can eventually buy and sell from one account, with campus pickup as the default handover.

## Project status

The local application includes member authentication and verification, listing creation and moderation, search, cart and checkout, manual UPI reference review, buyer/seller orders and pickup confirmation, messaging, notifications, reviews, reports, seller dashboards, and admin queues/settings. The initial schema and NIT Calicut college row have been applied to the pilot project, and the public college lookup has been confirmed. The additional audited pickup-management migration and real role-by-role authorization and end-to-end workflow checks are still outstanding. It is not ready for a live pilot yet.

## Local setup

Requirements: Node.js 20.9 or newer and npm. Node.js 26.13.0 and npm 11.20.0 were available when this project was scaffolded.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The landing page, setup guidance, and offline fallback work without Supabase credentials. Set the Supabase URL and publishable key for account sessions, the canonical site URL for auth callbacks, and the server-only secret key for secure file uploads.

For a local UI walkthrough before creating a member, `.env.local` may set `LOOPEC_DEV_BYPASS_AUTH=true`. This is honored only by `next dev`, shows clearly marked sample listings, and does not grant access to production or allow account actions. Remove the flag when you want to test real authentication.

## Supabase setup

1. Create the pilot Supabase project and add its URL, publishable key, secret key, and canonical site origin to `.env.local`. The secret key must be named `SUPABASE_SECRET_KEY` with no `NEXT_PUBLIC_` prefix; keep it only in server environments.
2. Apply `supabase/migrations/20261107000000_initial_schema.sql` only to that pilot project. If you already applied it, do not rerun it.
3. In the project's Data API settings, confirm the Data API is enabled and `public` is in Exposed schemas. `public` is normally exposed by default, but project settings can disable it. The migrations grant the required database roles; RLS still controls which rows each user can access. Do not grant `anon` access to marketplace tables; an unauthenticated `42501` denial is expected for categories, products, and pickup points.
4. Run `supabase/seeds/nit_calicut.sql` in the Supabase SQL Editor. It adds National Institute of Technology Calicut with the confirmed `nitc.ac.in` domain for students, faculty, and staff.
5. Run the read-only `supabase/operations/pilot_preflight.sql` in the Supabase SQL Editor as the project owner. It reports `PASS` or `CHECK` for tables, RLS, grants, Storage, Realtime, and migration-specific objects; it makes no database changes and does not record migration history. Compare its results with the remaining steps and never rerun the initial schema or seed because a follow-up check needs attention.
6. Apply `supabase/migrations/20261109000000_admin_pickup_locations.sql` after the initial schema. It adds an admin-only audited function for pickup point management.
7. Apply `supabase/migrations/20261109000001_realtime_messages.sql` to add private conversation messages to the Realtime publication.
8. Apply `supabase/migrations/20261109000002_action_rate_limits.sql` once to add database-enforced user limits for writes and private uploads; skip it if already applied. Supabase Auth applies its own registration and email throttles.
9. Apply `supabase/migrations/20261110044017_pilot_security_fixes.sql` after the rate-limit migration. It closes the profile, suspension, and upload-policy gaps found during review.
10. Register and confirm the first admin account, replace the email in `supabase/operations/promote_first_college_admin.sql`, then run that script once in the Supabase SQL Editor as the project owner. It checks the confirmed `nitc.ac.in` account, promotes it for NIT Calicut, and records the bootstrap in `audit_logs`. Create a separate super-admin only when global settings management is needed.
11. Sign in as the college admin and add only campus-approved meeting points at `/admin/pickup`.
12. Configure Supabase Auth email delivery and redirect URLs, including `/auth/callback`, before enabling registration.

The migrations create private `verification-documents` and `product-images` buckets and limit MIME types and file size. Authenticated clients cannot upload directly: protected server actions check the file signature and consume the database upload quota before writing with the server-only secret key. Verification documents remain private and are accessible only to their owner and authorized college admins. Never add a Supabase secret key to a `NEXT_PUBLIC_` variable or browser code.

The Supabase SSR package is the official cookie-based integration used here. Keep the browser, cookie-bound user, and server-only storage clients separate; validate authorization in the user session and RLS before privileged Storage writes. The secret key bypasses RLS and must remain server-only. No payment provider, email-delivery provider, or production domain is configured. Checkout uses the pilot's manual UPI-reference workflow; an admin must independently verify payment before an order can advance to paid. Configure a trusted payment provider before automating payment confirmation.

## Commands

```powershell
npm run dev
npm run lint
npm run typecheck
npm run build
```

With `npm run dev` running in another terminal, `npm run test:smoke` checks the landing page, developer marketplace preview, sign-in page, manifest, service worker, offline fallback, and PWA image assets.

## Database tests

Install the Supabase CLI and a Docker-compatible runtime, then run `supabase start` followed by `supabase test db` from the repository root. The checked-in `supabase/config.toml` applies the migrations and NITC seed to a local Supabase stack; these commands do not modify the hosted pilot project. The pgTAP suite covers schema privileges, RLS, NITC verification approval, listing moderation, checkout idempotency, payment review, order transitions, pickup, inventory restoration, and audit entries. The suite still needs to be run locally and against the hosted pilot before release.

## Architecture

- `app/`: App Router pages, metadata and global theme.
- `components/`: shared brand and UI primitives.
- `lib/auth/`: claim-verified member helpers and safe user-facing auth messages.
- `lib/supabase/`: isolated browser, cookie-bound server, server-only Storage, and session-refresh clients.
- `supabase/migrations/`: schema, constraints, RLS, private buckets and guarded workflow RPCs.
- `docs/BUILD_CHECKLIST.md`: phased implementation and launch-readiness checklist.

## Current pilot gaps

- Apply the follow-up migrations, including the pilot security fixes, to the hosted project; seed approved NITC pickup locations through the admin page; and run the access matrix and two-member pilot path in `docs/BUILD_CHECKLIST.md`.
- The About page is ready; Terms and Privacy pages are pilot drafts and need college/legal review, an operator contact, and retention details before registration opens.
- Configure the server-only Supabase secret key in development and production, email delivery, redirect allowlists, hosting/domain, backups, monitoring, and apply the action rate-limit and pilot security migrations.
- Run the included pgTAP suite locally and verify the remaining hosted-project RLS, access-matrix, email-delivery, storage and two-member acceptance workflows. Complete accessibility, mobile/PWA, performance and security reviews.

Orders are modeled as one buyer and one seller per order. A multi-seller cart will be split into multiple orders. Payment confirmation is reserved for a trusted provider/server workflow; no browser success signal can set an order to paid.
