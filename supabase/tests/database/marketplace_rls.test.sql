begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(9);

set local request.jwt.claim.sub = '';
set local request.jwt.claims = '';

insert into public.colleges (name, slug, email_domains, is_active)
values ('National Institute of Technology Calicut', 'nit-calicut', array['nitc.ac.in'], true)
on conflict (slug) do update
set name = excluded.name, email_domains = excluded.email_domains, is_active = true;

insert into public.colleges (name, slug, email_domains, is_active)
values ('LOOPEC RLS Test College', 'loopec-rls-test-college', array['test.example'], true)
on conflict (slug) do update
set name = excluded.name, email_domains = excluded.email_domains, is_active = true;

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'rls-seller@nitc.ac.in', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"NITC Seller"}'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'rls-pending@nitc.ac.in', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"NITC Pending Member"}'),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'rls-outsider@test.example', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Other College Member"}'),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'rls-admin@nitc.ac.in', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"NITC Admin"}');

update public.profiles
set college_id = (select id from public.colleges where slug = 'nit-calicut'),
    verification_status = 'approved'
where id = '11111111-1111-4111-8111-111111111111';

update public.profiles
set college_id = (select id from public.colleges where slug = 'nit-calicut'),
    verification_status = 'pending'
where id = '22222222-2222-4222-8222-222222222222';

update public.profiles
set college_id = (select id from public.colleges where slug = 'loopec-rls-test-college'),
    verification_status = 'approved'
where id = '33333333-3333-4333-8333-333333333333';

update public.profiles
set college_id = (select id from public.colleges where slug = 'nit-calicut'),
    role = 'college_admin',
    verification_status = 'approved'
where id = '44444444-4444-4444-8444-444444444444';

insert into public.products (
  id, college_id, seller_id, category_id, name, description, price,
  item_condition, quantity, status, published_at
)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select id from public.colleges where slug = 'nit-calicut'), '11111111-1111-4111-8111-111111111111', (select id from public.categories where slug = 'books-study-materials'), 'NITC approved RLS item', 'Approved item visible to NITC members.', 100, 'good', 1, 'approved', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', (select id from public.colleges where slug = 'nit-calicut'), '22222222-2222-4222-8222-222222222222', (select id from public.categories where slug = 'books-study-materials'), 'NITC pending RLS item', 'Pending item visible only to its seller and campus admin.', 100, 'good', 1, 'pending', now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', (select id from public.colleges where slug = 'loopec-rls-test-college'), '33333333-3333-4333-8333-333333333333', (select id from public.categories where slug = 'books-study-materials'), 'Foreign college RLS item', 'Approved item isolated to another college.', 100, 'good', 1, 'approved', now()),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', (select id from public.colleges where slug = 'nit-calicut'), '22222222-2222-4222-8222-222222222222', (select id from public.categories where slug = 'books-study-materials'), 'NITC member own draft', 'A seller can inspect their own unsubmitted listing.', 100, 'good', 1, 'draft', null);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select extensions.is((select count(*)::integer from public.products where name = 'NITC approved RLS item'), 1, 'an approved NITC member can read approved NITC listings');
select extensions.is((select count(*)::integer from public.products where name = 'NITC pending RLS item'), 0, 'an approved member cannot read another seller pending listing');
select extensions.is((select count(*)::integer from public.products where name = 'Foreign college RLS item'), 0, 'an approved member cannot read another college listings');

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select extensions.is((select count(*)::integer from public.products where name = 'NITC approved RLS item'), 0, 'a pending member cannot browse approved marketplace listings');
select extensions.is((select count(*)::integer from public.products where name = 'NITC member own draft'), 1, 'a member can read their own draft while awaiting approval');

set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select extensions.is((select count(*)::integer from public.products where name = 'NITC pending RLS item'), 1, 'a college admin can review listings in their college');
select extensions.is((select count(*)::integer from public.products where name = 'Foreign college RLS item'), 0, 'a college admin cannot inspect another colleges listings');

set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select extensions.is((select count(*)::integer from public.products where name = 'NITC approved RLS item'), 0, 'another college member cannot discover NITC listings');
select extensions.is((select count(*)::integer from public.products where name = 'Foreign college RLS item'), 1, 'members can browse approved listings in their own college');

select * from extensions.finish();
rollback;
