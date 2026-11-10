begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(13);

set local request.jwt.claim.sub = '';
set local request.jwt.claims = '';

insert into public.colleges (name, slug, email_domains, is_active)
values ('National Institute of Technology Calicut', 'nit-calicut', array['nitc.ac.in'], true)
on conflict (slug) do update
set name = excluded.name, email_domains = excluded.email_domains, is_active = true;

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'security-buyer@nitc.ac.in', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Security Buyer"}'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'security-seller@nitc.ac.in', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Security Seller"}'),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'security-pending@nitc.ac.in', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Security Pending"}'),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'security-admin@nitc.ac.in', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Security Admin"}'),
  ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'security-peer@nitc.ac.in', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Security Peer"}');

update public.profiles
set college_id = (select id from public.colleges where slug = 'nit-calicut'), verification_status = 'approved', phone = '9990001111'
where id = '11111111-1111-4111-8111-111111111111';
update public.profiles
set college_id = (select id from public.colleges where slug = 'nit-calicut'), verification_status = 'approved', phone = '9990002222'
where id = '22222222-2222-4222-8222-222222222222';
update public.profiles
set college_id = (select id from public.colleges where slug = 'nit-calicut'), verification_status = 'pending', phone = '9990003333'
where id = '33333333-3333-4333-8333-333333333333';
update public.profiles
set college_id = (select id from public.colleges where slug = 'nit-calicut'), role = 'college_admin', verification_status = 'approved'
where id = '44444444-4444-4444-8444-444444444444';
update public.profiles
set college_id = (select id from public.colleges where slug = 'nit-calicut'), verification_status = 'approved'
where id = '55555555-5555-4555-8555-555555555555';

insert into public.pickup_locations (id, college_id, name, address, is_active)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', (select id from public.colleges where slug = 'nit-calicut'), 'Security Test Point', 'NITC test location', true);
insert into public.products (id, college_id, seller_id, category_id, name, description, price, item_condition, quantity, status, published_at)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select id from public.colleges where slug = 'nit-calicut'), '22222222-2222-4222-8222-222222222222', (select id from public.categories where slug = 'books-study-materials'), 'Suspended seller item', 'Approved item used to validate suspension controls.', 100, 'good', 2, 'approved', now());
insert into public.orders (id, college_id, buyer_id, seller_id, pickup_location_id, status, subtotal, commission_amount, total_amount)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', (select id from public.colleges where slug = 'nit-calicut'), '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'completed', 100, 5, 100);
update public.profiles set suspended_at = now() where id = '22222222-2222-4222-8222-222222222222';

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select extensions.is((select count(*)::integer from public.profiles where id = '33333333-3333-4333-8333-333333333333'), 0, 'approved peers cannot read pending profiles');
select extensions.is((select count(*)::integer from public.profiles where id = '22222222-2222-4222-8222-222222222222'), 0, 'approved peers cannot read suspended profiles');
select extensions.is((select count(*)::integer from public.products where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0, 'approved peers cannot see listings from suspended sellers');
select extensions.is((select count(*)::integer from public.profiles where id = '55555555-5555-4555-8555-555555555555'), 1, 'approved peers can read approved active profiles');
select extensions.throws_ok(
  $$insert into public.cart_items (user_id, product_id, quantity) values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1)$$,
  '42501', null, 'buyers cannot add suspended sellers products to a cart'
);
select extensions.throws_ok(
  $$select public.create_single_checkout_order('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '99999999-9999-4999-8999-999999999999')$$,
  'P0001', 'This seller is not available for new orders', 'checkout rejects a suspended seller even if their listing remains approved'
);
select extensions.throws_ok(
  $$insert into public.reviews (order_id, reviewer_id, reviewed_user_id, rating, comment) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 5, 'Late review')$$,
  'P0001', 'Only active approved members can submit a review', 'suspended participants cannot write reviews through the Data API'
);
select extensions.throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('product-images', '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/direct.jpg')$$,
  '42501', null, 'authenticated clients cannot bypass server validation with direct Storage inserts'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select extensions.is((select count(*)::integer from public.profiles where id = '22222222-2222-4222-8222-222222222222'), 1, 'suspended members can still read their own profile');
select extensions.is((with changed as (update public.profiles set phone = '0000000000' where id = '22222222-2222-4222-8222-222222222222' returning 1) select count(*)::integer from changed), 0, 'suspended members cannot update their own profile');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select extensions.is((select count(*)::integer from public.profiles where id = '33333333-3333-4333-8333-333333333333'), 1, 'pending members can still read their own profile');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select extensions.is((select count(*)::integer from public.profiles where id in ('22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333')), 2, 'college admins retain access to pending and suspended profiles');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
set local request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';
select extensions.throws_ok(
  $$insert into public.reviews (order_id, reviewer_id, reviewed_user_id, rating, comment) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 5, 'Not an order participant')$$,
  '42501', null, 'active members cannot review orders they did not participate in'
);

select * from extensions.finish();
rollback;
