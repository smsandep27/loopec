# LOOPEC build checklist

Delivery target: an initial one-college pilot, planned over 18 days, with a development budget below ₹10,000. Keep the first release focused on verified users, campus pickup, and safe peer-to-peer exchange. Confirm actual hosting, email, payment, and storage costs before launch.

## Phase 1 — Foundation

- [x] Create a clean Next.js App Router project with TypeScript, Tailwind CSS, ESLint, and npm lockfile.
- [x] Establish a premium purple and neutral design system with reusable brand and button components.
- [x] Build a responsive public landing page that describes the intended service without fake product listings.
- [x] Keep marketplace navigation reachable on narrow screens with a compact accessible menu.
- [x] Add the web manifest, install metadata, service worker registration, and a minimal offline fallback. The service worker caches only the offline page and never caches private pages or user data.
- [x] Provide 192px, 512px, maskable, and Apple touch PNG icons for PWA installation.
- [x] Add Supabase browser and server client factories using the public publishable key and cookie-based SSR.
- [x] Add `.env.example`, project setup instructions, and a maintainable phase checklist.
- [x] Add About, Terms, and Privacy pages; keep policy drafts visibly marked for pilot operator review.
- [x] Draft the normalized PostgreSQL migration with core tables, indexes, constraints, RLS, private storage buckets, and guarded verification, moderation, and order-state RPCs.
- [x] Apply the initial schema and NIT Calicut seed; confirm the expected 20 tables, seven enum types, and public NITC college lookup.
- [ ] Verify policies against real `anon`, approved-member, seller, college-admin, and super-admin sessions.
- [ ] Add generated database types after the schema is applied to the pilot Supabase project.

## Phase 2 — Authentication and verification

- [x] Add signup, sign-in, sign-out, email confirmation, password reset, and session refresh through Supabase Auth.
- [x] Restrict signup to configured college domains and require a confirmed college email.
- [x] Add private college-ID uploads with MIME-signature, size, ownership, and path validation.
- [x] Build private admin verification review with signed document links, role/status changes, and audit entries in the migration.
- [x] Build member profile management; privileged roles are outside user-editable fields.
- [x] Build pending, approved, rejected, and suspended states with review and audit workflows.
- [x] Protect marketplace actions and pages server-side and re-check authorization in RLS.
- [ ] Verify these flows, signed storage access, and audit entries against a live Supabase project.

## Phase 3 — Marketplace

- [x] Add product create/edit, draft deletion, approved listing withdrawal, private image uploads, seller ownership, moderation, and availability rules.
- [x] Add search, categories, price filters, sorting, recently added, and featured listings using database queries.
- [x] Build product details, seller profile, verified badge, wishlist, and related products.
- [ ] Verify suspended users and non-approved listings cannot appear in search, signed images, or direct product URLs under live RLS.

## Phase 4 — Orders and campus pickup

- [x] Implement server-side checkout that re-reads prices and stock, groups items by seller, locks inventory, and creates order snapshots transactionally.
- [x] Add buyer and seller order views, cancellation rules, order-state transitions, and two-party pickup confirmation.
- [x] Build audited admin management for college pickup points with college-scoped authorization.
- [ ] Add the campus-approved NITC pickup points after the college names the approved meeting locations.
- [ ] Apply `20261109000000_admin_pickup_locations.sql` to the pilot project after the initial schema.
- [x] Implement manual UPI reference submission and admin review; no client action can mark an order paid.
- [x] Add checkout idempotency, commission snapshots, manual-payment review records, and audit records.
- [ ] Test concurrent stock reservation, duplicate checkout requests, cancellation/restock, and payment review against the pilot database.
- [ ] Automate provider webhooks or refunds if the pilot adopts a payment provider; these are not implemented.

## Phase 5 — Dashboards and communication

- [x] Build buyer/seller dashboard metrics, listing management, incoming orders, and sales summaries from database queries.
- [x] Add buyer-seller conversations, participant-scoped message access, unread state, and client-side Realtime subscriptions.
- [ ] Apply `20261109000001_realtime_messages.sql` and verify message delivery remains participant-scoped.
- [x] Add a notification centre and order/listing/verification/message events.
- [x] Add user-scoped database rate limits for messages, listings, verification, reports, checkout, payment references, and private uploads.
- [x] Add completed-order reviews and listing reports with moderation workflows.
- [x] Build admin user verification, suspension, product moderation, order overview, transaction activity, reports, overview metrics, and super-admin settings.
- [ ] Verify each admin queue and its audit records with college-admin and super-admin accounts in the pilot.

## Phase 6 — Production readiness

- [x] Run local TypeScript, lint, and optimized production-build checks.
- [x] Add and run no-dependency local smoke tests for the landing page, developer marketplace, sign-in, PWA manifest/assets, service worker, and offline fallback.
- [x] Add pgTAP coverage for verification approval, RLS, listing moderation, checkout idempotency, manual payment review, order/pickup transitions, inventory restoration, and audited pickup administration.
- [ ] Run the database suite with Supabase CLI and Docker; verify concurrency and role behavior against the pilot database.
- [ ] Verify Auth email delivery, signed Storage access, Realtime delivery, and any future payment-provider webhook idempotency.
- [ ] Run dependency and secret scans; review every server action, upload path, RLS policy, and privileged key boundary.
- [ ] Verify mobile and desktop layouts, keyboard navigation, focus states, reduced motion, and screen-reader labels.
- [ ] Verify PWA installability and offline behavior without caching authenticated or personal data on supported desktop and mobile browsers.
- [ ] Measure performance and correct Core Web Vitals issues; apply `20261109000002_action_rate_limits.sql` and verify limits in the pilot. Registration uses Supabase Auth's built-in throttles.
- [ ] Configure Vercel production/preview environments, Supabase redirect URLs, backup/restore, monitoring, and error reporting.
- [ ] Walk the end-to-end pilot acceptance path with two verified accounts and one college admin after the Supabase project is configured.

## Pilot release gate

- [ ] Verified user A is approved by an admin and can publish a listing.
- [ ] Verified user B can discover that listing, place an order, and coordinate campus pickup.
- [ ] Buyer and seller can complete valid order transitions; invalid transitions and client-forged payment success are rejected.
- [ ] Admin can review identity documents privately, moderate listings, suspend users, and view an audit trail.
- [ ] RLS tests prove unverified, suspended, cross-college, and unrelated users cannot read or mutate protected records.
- [ ] Mobile/desktop, installability, offline fallback, deployment, backup, and operational handoff are verified.
