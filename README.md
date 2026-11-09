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

Open [http://localhost:3000](http://localhost:3000). The landing page, setup guidance, and offline fallback work without Supabase credentials. Set the Supabase URL, publishable key, and canonical site URL to enable accounts and verification.

For a local UI walkthrough before creating a member, `.env.local` may set `LOOPEC_DEV_BYPASS_AUTH=true`. This is honored only by `next dev`, shows clearly marked sample listings, and does not grant access to production or allow account actions. Remove the flag when you want to test real authentication.

## Supabase setup

1. Create the pilot Supabase project and add its URL, publishable key, and canonical site origin to `.env.local`.
2. Apply `supabase/migrations/20261107000000_initial_schema.sql` only to that pilot project. If you already applied it, do not rerun it.
3. Enable the `public` schema in the project's Data API settings if using the PostgREST client. New tables are not automatically API-exposed for projects created after October 30, 2026; SQL RLS and grants still govern access.
4. Run `supabase/seeds/nit_calicut.sql` in the Supabase SQL Editor. It adds National Institute of Technology Calicut with the confirmed `nitc.ac.in` domain for students, faculty, and staff.
5. Apply `supabase/migrations/20261109000000_admin_pickup_locations.sql` after the initial schema. It adds an admin-only audited function for pickup point management.
6. Apply `supabase/migrations/20261109000001_realtime_messages.sql` to add private conversation messages to the Realtime publication.
7. Apply `supabase/migrations/20261109000002_action_rate_limits.sql` once to add database-enforced user limits for writes and private uploads; skip it if already applied. Supabase Auth applies its own registration and email throttles.
8. Register and confirm the first admin account, replace the email in `supabase/operations/promote_first_college_admin.sql`, then run that script once in the Supabase SQL Editor as the project owner. It checks the confirmed `nitc.ac.in` account, promotes it for NIT Calicut, and records the bootstrap in `audit_logs`. Create a separate super-admin only when global settings management is needed.
9. Sign in as the college admin and add only campus-approved meeting points at `/admin/pickup`.
10. Configure Supabase Auth email delivery and redirect URLs, including `/auth/callback`, before enabling registration.

The migration creates private `verification-documents` and `product-images` buckets, limits MIME types and file size, and adds RLS policies. Verification files are stored as object paths and are never placed in a public bucket. The publishable key is safe to expose only because database and Storage access is restricted by RLS. Never add a Supabase secret/service-role key to a `NEXT_PUBLIC_` variable or browser code.

The Supabase SSR package is the official cookie-based integration used here and is currently marked beta in Supabase documentation. Keep its browser and server clients separate and validate all authorization in server code and RLS. No payment provider, service-role client, email-delivery provider, or production domain is configured. Checkout uses the pilot's manual UPI-reference workflow; an admin must independently verify payment before an order can advance to paid. Configure a trusted payment provider before automating payment confirmation.

## Commands

```powershell
npm run dev
npm run lint
npm run typecheck
npm run build
```

## Architecture

- `app/`: App Router pages, metadata and global theme.
- `components/`: shared brand and UI primitives.
- `lib/auth/`: claim-verified member helpers and safe user-facing auth messages.
- `lib/supabase/`: isolated browser, server, and session-refresh clients; no privileged client.
- `supabase/migrations/`: schema, constraints, RLS, private buckets and guarded workflow RPCs.
- `docs/BUILD_CHECKLIST.md`: phased implementation and launch-readiness checklist.

## Current pilot gaps

- Apply the pickup-management migration, seed approved NITC pickup locations through the admin page, and run the access matrix and two-member pilot path in `docs/BUILD_CHECKLIST.md`.
- The About page is ready; Terms and Privacy pages are pilot drafts and need college/legal review, an operator contact, and retention details before registration opens.
- Configure production email delivery, redirect allowlists, hosting/domain, backups, monitoring and apply the action rate-limit migration.
- Complete accessibility, mobile/PWA, performance and security reviews. Automated integration/RLS tests are not included yet.

Orders are modeled as one buyer and one seller per order. A multi-seller cart will be split into multiple orders. Payment confirmation is reserved for a trusted provider/server workflow; no browser success signal can set an order to paid.
