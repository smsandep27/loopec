begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(40);

set local request.jwt.claim.sub = '';
set local request.jwt.claims = '';

insert into public.colleges (name, slug, email_domains, is_active)
values ('National Institute of Technology Calicut', 'nit-calicut', array['nitc.ac.in'], true)
on conflict (slug) do update
set name = excluded.name, email_domains = excluded.email_domains, is_active = true;

insert into public.colleges (name, slug, email_domains, is_active)
values ('LOOPEC Workflow Test College', 'loopec-workflow-test-college', array['workflow.example'], true)
on conflict (slug) do update
set name = excluded.name, email_domains = excluded.email_domains, is_active = true;

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'workflow-buyer@nitc.ac.in', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Workflow Buyer"}'),
  ('66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'workflow-seller@nitc.ac.in', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Workflow Seller"}'),
  ('77777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated', 'workflow-admin@nitc.ac.in', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Workflow Admin"}');

update public.profiles
set college_id = (select id from public.colleges where slug = 'nit-calicut'),
    verification_status = 'approved'
where id = '66666666-6666-4666-8666-666666666666';

update public.profiles
set college_id = (select id from public.colleges where slug = 'nit-calicut'),
    role = 'college_admin',
    verification_status = 'approved'
where id = '77777777-7777-4777-8777-777777777777';

insert into public.pickup_locations (id, college_id, name, address, instructions, sort_order, is_active)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  (select id from public.colleges where slug = 'nit-calicut'),
  'Workflow Test Point', 'NITC workflow test gate', '', 10, true
);

insert into public.products (
  id, college_id, seller_id, category_id, name, description, price,
  item_condition, quantity, status, published_at
)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', (select id from public.colleges where slug = 'nit-calicut'), '66666666-6666-4666-8666-666666666666', (select id from public.categories where slug = 'books-study-materials'), 'Workflow checkout item', 'A test item for campus checkout and pickup.', 100, 'good', 1, 'approved', now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', (select id from public.colleges where slug = 'nit-calicut'), '66666666-6666-4666-8666-666666666666', (select id from public.categories where slug = 'books-study-materials'), 'Workflow cancellation item', 'A test item for cancellation inventory restore.', 150, 'good', 1, 'approved', now());

-- The buyer starts without a college assignment or approval, then submits an ID record.
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
set local request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';
select extensions.lives_ok(
  $$insert into public.user_verifications (id, user_id, college_id, requested_role, college_email, id_document_path)
    values ('88888888-8888-4888-8888-888888888888', '55555555-5555-4555-8555-555555555555', (select id from public.colleges where slug = 'nit-calicut'), 'student', 'workflow-buyer@nitc.ac.in', '55555555-5555-4555-8555-555555555555/99999999-9999-4999-8999-999999999999.pdf')$$,
  'a confirmed NITC member can submit a college verification record'
);
select extensions.is((select verification_status::text from public.profiles where id = '55555555-5555-4555-8555-555555555555'), 'pending', 'verification submission moves the profile to pending');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';
set local request.jwt.claims = '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}';
select extensions.lives_ok(
  $$select public.review_verification('88888888-8888-4888-8888-888888888888', 'approved'::public.verification_status, null)$$,
  'the college admin can approve a pending NITC verification'
);
select extensions.is((select verification_status::text from public.profiles where id = '55555555-5555-4555-8555-555555555555'), 'approved', 'approval activates the buyer profile');
select extensions.is((select role::text from public.profiles where id = '55555555-5555-4555-8555-555555555555'), 'student', 'approval assigns only the requested community role');
select extensions.is((select count(*)::integer from public.audit_logs where action = 'verification_approved' and entity_id = '88888888-8888-4888-8888-888888888888'), 1, 'verification approval is audited');

-- The approved buyer creates a draft; it becomes public only after admin moderation.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
set local request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';
select extensions.lives_ok(
  $$insert into public.products (id, college_id, seller_id, category_id, name, description, price, item_condition, quantity)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select id from public.colleges where slug = 'nit-calicut'), '55555555-5555-4555-8555-555555555555', (select id from public.categories where slug = 'books-study-materials'), 'Workflow submitted listing', 'A draft used to verify the moderation workflow.', 80, 'good', 1)$$,
  'an approved NITC member can create a draft listing'
);
select extensions.lives_ok($$select public.submit_product('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$, 'a seller can submit their draft for moderation');
select extensions.is((select status::text from public.products where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'pending', 'submission keeps the product hidden pending review');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';
set local request.jwt.claims = '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}';
select extensions.lives_ok($$select public.moderate_product('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'approved'::public.product_status, null)$$, 'the college admin can approve a pending NITC listing');
select extensions.is((select status::text from public.products where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'approved', 'moderation publishes the listing');
select extensions.is((select count(*)::integer from public.audit_logs where action = 'product_approved' and entity_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1, 'listing moderation is audited');
select extensions.lives_ok(
  $$select public.manage_pickup_location('dddddddd-dddd-4ddd-8ddd-dddddddddddd', (select id from public.colleges where slug = 'nit-calicut'), 'Updated Workflow Point', 'NITC main gate', 'Meet beside the security desk.', 10::smallint, true)$$,
  'the college admin can update an approved pickup location'
);
select extensions.is((select name from public.pickup_locations where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), 'Updated Workflow Point', 'pickup management saves the updated meeting point');
select extensions.is((select count(*)::integer from public.audit_logs where action = 'pickup_location_updated' and entity_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), 1, 'pickup point changes are audited');
select extensions.throws_ok(
  $$select public.manage_pickup_location(null, (select id from public.colleges where slug = 'loopec-workflow-test-college'), 'Foreign Point', 'Other campus', '', 20::smallint, true)$$,
  '42501', 'cannot manage pickup locations for another college',
  'an NITC college admin cannot create a pickup point for another college'
);

-- Checkout uses the database price/stock, is idempotent, and records manual payment for review.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
set local request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';
select extensions.is(
  public.create_single_checkout_order('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  public.create_single_checkout_order('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  'repeating a checkout request with the same key returns the same order'
);
select extensions.is((select count(*)::integer from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666'), 1, 'idempotent checkout creates one order');
select extensions.is((select status::text || ':' || quantity::text from public.products where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'sold:0', 'checkout atomically reserves the last item');
select extensions.throws_ok(
  $$select public.transition_order_status((select id from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1), 'accepted'::public.order_status)$$,
  'P0001', 'Invalid or unauthorized order status transition',
  'the buyer cannot accept the seller order'
);
select extensions.is((select status::text from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1), 'pending', 'an invalid transition leaves the order unchanged');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-4666-8666-666666666666';
set local request.jwt.claims = '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}';
select extensions.lives_ok(
  $$select public.transition_order_status((select id from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1), 'accepted'::public.order_status)$$,
  'the seller can accept an incoming order'
);
select extensions.throws_ok(
  $$select public.transition_order_status((select id from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1), 'ready_for_pickup'::public.order_status)$$,
  'P0001', 'Invalid or unauthorized order status transition',
  'the seller cannot skip payment review and must wait until the order is paid'
);

-- Buyer starts the payment-pending phase and submits a reference; only an admin can mark it paid.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
set local request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';
select extensions.lives_ok(
  $$select public.transition_order_status((select id from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1), 'payment_pending'::public.order_status)$$,
  'the buyer can start manual payment after seller acceptance'
);
select extensions.lives_ok(
  $$select public.submit_manual_payment_reference((select id from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1), 'NITC123456789')$$,
  'the buyer can submit a well-formed manual payment reference'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';
set local request.jwt.claims = '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}';
select extensions.lives_ok(
  $$select public.transition_order_status((select id from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1), 'paid'::public.order_status)$$,
  'the college admin can mark a submitted manual payment as paid'
);
select extensions.is((select status::text from public.payments where order_id = (select id from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1)), 'paid', 'admin payment review updates the payment record');
select extensions.is((select count(*)::integer from public.transactions where order_id = (select id from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1) and transaction_type = 'payment'), 1, 'admin payment review writes one financial ledger entry');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-4666-8666-666666666666';
set local request.jwt.claims = '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}';
select extensions.lives_ok(
  $$select public.transition_order_status((select id from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1), 'ready_for_pickup'::public.order_status)$$,
  'the seller can mark a paid order ready for campus pickup'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
set local request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';
select extensions.lives_ok(
  $$select public.transition_order_status((select id from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1), 'completed'::public.order_status)$$,
  'the buyer can confirm campus handover'
);
select extensions.is((select status::text from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1), 'ready_for_pickup', 'one handover confirmation does not complete the order');
select extensions.ok((select buyer_confirmed_at is not null from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1), 'the buyers handover confirmation is recorded');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-4666-8666-666666666666';
set local request.jwt.claims = '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}';
select extensions.lives_ok(
  $$select public.transition_order_status((select id from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1), 'completed'::public.order_status)$$,
  'the seller can confirm handover to complete the order'
);
select extensions.is((select status::text from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1), 'completed', 'both participants must confirm before order completion');
select extensions.ok((select buyer_confirmed_at is not null and seller_confirmed_at is not null from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1), 'both pickup confirmations are retained');
select extensions.is((select count(*)::integer from public.audit_logs where action = 'order_completed' and entity_id = (select id from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' order by created_at limit 1)), 1, 'completed handover is audited');

-- A separate order cancellation restores the reserved inventory and fails its pending payment.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
set local request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';
select extensions.ok(
  public.create_single_checkout_order('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'ffffffff-ffff-4fff-8fff-ffffffffffff') is not null,
  'the buyer can create a second order with a new idempotency key'
);
select extensions.lives_ok(
  $$select public.transition_order_status((select id from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' and status = 'pending' order by created_at desc limit 1), 'cancelled'::public.order_status)$$,
  'the buyer can cancel an eligible pending order'
);
select extensions.is((select status::text || ':' || quantity::text from public.products where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), 'approved:1', 'cancellation restores reserved stock');
select extensions.is((select status::text from public.payments where order_id = (select id from public.orders where buyer_id = '55555555-5555-4555-8555-555555555555' and seller_id = '66666666-6666-4666-8666-666666666666' and status = 'cancelled' order by created_at desc limit 1)), 'failed', 'cancellation closes the pending payment attempt');

select * from extensions.finish();
rollback;
