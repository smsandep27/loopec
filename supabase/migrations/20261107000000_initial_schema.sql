-- LOOPEC foundation schema. Apply to the selected pilot Supabase project.
-- Private verification and product media are stored in private Storage buckets below.

create type public.community_role as enum (
  'student', 'faculty', 'staff', 'college_admin', 'super_admin'
);
create type public.verification_status as enum (
  'not_submitted', 'pending', 'approved', 'rejected', 'suspended'
);
create type public.product_condition as enum ('new', 'like_new', 'good', 'used');
create type public.product_status as enum (
  'draft', 'pending', 'approved', 'sold', 'rejected', 'removed'
);
create type public.order_status as enum (
  'pending', 'accepted', 'rejected', 'payment_pending', 'paid',
  'ready_for_pickup', 'completed', 'cancelled', 'refunded'
);
create type public.payment_status as enum ('pending', 'authorized', 'paid', 'failed', 'refunded');
create type public.report_status as enum ('open', 'under_review', 'resolved', 'dismissed');

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

create table public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  email_domains text[] not null check (cardinality(email_domains) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  college_id uuid references public.colleges(id) on delete restrict,
  role public.community_role not null default 'student',
  verification_status public.verification_status not null default 'not_submitted',
  full_name text not null check (char_length(full_name) between 1 and 120),
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9-]{2,31}$'),
  phone text,
  bio text check (bio is null or char_length(bio) <= 500),
  avatar_path text,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete restrict,
  requested_role public.community_role not null check (requested_role in ('student', 'faculty', 'staff')),
  college_email text not null,
  id_document_path text not null,
  status public.verification_status not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id_document_path !~ '^/' and id_document_path !~ '(^|/)\.\.(\/|$)')
);
create unique index user_verifications_one_pending_per_user
  on public.user_verifications(user_id) where status = 'pending';
create index user_verifications_review_queue_idx
  on public.user_verifications(college_id, created_at) where status = 'pending';

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null check (char_length(name) between 3 and 140),
  description text not null check (char_length(description) between 10 and 5000),
  price numeric(12,2) not null check (price >= 0),
  item_condition public.product_condition not null,
  quantity integer not null default 1 check (quantity between 1 and 1000),
  status public.product_status not null default 'draft',
  moderation_notes text check (moderation_notes is null or char_length(moderation_notes) <= 1000),
  moderated_by uuid references public.profiles(id) on delete set null,
  moderated_at timestamptz,
  is_featured boolean not null default false,
  published_at timestamptz,
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_marketplace_idx
  on public.products(college_id, category_id, published_at desc)
  where status = 'approved';
create index products_seller_idx on public.products(seller_id, created_at desc);
create index products_moderated_by_fk_idx on public.products(moderated_by);
create index products_price_idx on public.products(college_id, price) where status = 'approved';
create index products_search_idx on public.products using gin(search_vector) where status = 'approved';

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null default '' check (char_length(alt_text) <= 240),
  sort_order smallint not null default 0 check (sort_order between 0 and 19),
  created_at timestamptz not null default now(),
  unique (product_id, sort_order),
  check (storage_path !~ '^/' and storage_path !~ '(^|/)\.\.(\/|$)')
);
create index product_images_product_idx on public.product_images(product_id, sort_order);

create table public.wishlists (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.cart_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.pickup_locations (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 120),
  address text not null check (char_length(address) between 3 and 300),
  instructions text not null default '' check (char_length(instructions) <= 1200),
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pickup_locations_college_idx
  on public.pickup_locations(college_id, sort_order) where is_active;

-- Each order is between one buyer and one seller; multi-seller carts become separate orders.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  pickup_location_id uuid references public.pickup_locations(id) on delete set null,
  status public.order_status not null default 'pending',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  commission_amount numeric(12,2) not null default 0 check (commission_amount >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  currency char(3) not null default 'INR' check (currency = upper(currency)),
  buyer_confirmed_at timestamptz,
  seller_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  check (total_amount = subtotal),
  unique (id, buyer_id, seller_id)
);
create index orders_buyer_idx on public.orders(buyer_id, created_at desc);
create index orders_seller_idx on public.orders(seller_id, created_at desc);
create index orders_status_idx on public.orders(status, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null check (char_length(product_name) between 3 and 140),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 1000),
  line_total numeric(12,2) not null check (line_total = unit_price * quantity),
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items(order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null check (char_length(provider) between 2 and 40),
  method text not null check (method in ('manual_upi', 'upi_provider')),
  status public.payment_status not null default 'pending',
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null default 'INR',
  provider_payment_id text unique,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  idempotency_key text not null unique,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments(order_id, created_at desc);
create index payments_reviewed_by_fk_idx on public.payments(reviewed_by);

-- Append-only financial record; payment provider confirmation is performed server-side.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('payment', 'commission', 'refund')),
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  commission_amount numeric(12,2) not null default 0 check (commission_amount >= 0),
  seller_net_amount numeric(12,2) not null check (seller_net_amount >= 0),
  currency char(3) not null default 'INR',
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index transactions_order_idx on public.transactions(order_id, created_at desc);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);
create index conversations_buyer_idx on public.conversations(buyer_id, updated_at desc);
create index conversations_seller_idx on public.conversations(seller_id, updated_at desc);
create unique index conversations_product_unique_idx
  on public.conversations(buyer_id, seller_id, product_id) where product_id is not null;
create unique index conversations_order_unique_idx
  on public.conversations(buyer_id, seller_id, order_id) where order_id is not null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in (
    'verification', 'new_order', 'order_status', 'new_message', 'listing_status', 'system'
  )),
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body) <= 1000),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  reviewed_user_id uuid not null references public.profiles(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1200),
  created_at timestamptz not null default now(),
  unique (order_id, reviewer_id),
  check (reviewer_id <> reviewed_user_id)
);
create index reviews_reviewed_user_idx on public.reviews(reviewed_user_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null check (reason in ('prohibited_item', 'misleading_listing', 'safety', 'harassment', 'other')),
  details text not null default '' check (char_length(details) <= 2000),
  status public.report_status not null default 'open',
  moderator_id uuid references public.profiles(id) on delete set null,
  moderator_notes text check (moderator_notes is null or char_length(moderator_notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (product_id is not null or reported_user_id is not null)
);
create index reports_queue_idx on public.reports(status, created_at desc);
create index reports_reporter_idx on public.reports(reporter_id, created_at desc);

create table public.platform_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,79}$'),
  value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 3 and 100),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);

-- Foreign-key indexes support the RLS lookups and keep deletes/updates from scanning child tables.
create index profiles_college_fk_idx on public.profiles(college_id);
create index user_verifications_user_fk_idx on public.user_verifications(user_id);
create index user_verifications_college_fk_idx on public.user_verifications(college_id);
create index user_verifications_reviewer_fk_idx on public.user_verifications(reviewer_id);
create index products_college_fk_idx on public.products(college_id);
create index products_category_fk_idx on public.products(category_id);
create index wishlists_product_fk_idx on public.wishlists(product_id);
create index cart_items_product_fk_idx on public.cart_items(product_id);
create index pickup_locations_college_fk_idx on public.pickup_locations(college_id);
create index orders_college_fk_idx on public.orders(college_id);
create index orders_pickup_location_fk_idx on public.orders(pickup_location_id);
create index order_items_product_fk_idx on public.order_items(product_id);
create index transactions_payment_fk_idx on public.transactions(payment_id);
create index conversations_college_fk_idx on public.conversations(college_id);
create index conversations_product_fk_idx on public.conversations(product_id);
create index conversations_order_fk_idx on public.conversations(order_id);
create index reviews_reviewer_fk_idx on public.reviews(reviewer_id);
create index reports_product_fk_idx on public.reports(product_id);
create index reports_reported_user_fk_idx on public.reports(reported_user_id);
create index reports_moderator_fk_idx on public.reports(moderator_id);
create index platform_settings_updated_by_fk_idx on public.platform_settings(updated_by);

insert into public.categories (name, slug, sort_order) values
  ('Electronics', 'electronics', 10),
  ('Books & study materials', 'books-study-materials', 20),
  ('Fashion', 'fashion', 30),
  ('Accessories', 'accessories', 40),
  ('Sports equipment', 'sports-equipment', 50),
  ('Furniture', 'furniture', 60),
  ('Stationery', 'stationery', 70),
  ('Other', 'other', 80);

insert into public.platform_settings (key, value)
values ('default_commission_percent', '5'::jsonb);

create function app_private.is_approved_member(target_college_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.college_id = target_college_id
      and p.verification_status = 'approved'
      and p.suspended_at is null
  );
$$;

create function app_private.is_college_admin(target_college_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('college_admin', 'super_admin')
      and p.verification_status = 'approved'
      and p.suspended_at is null
      and (p.role = 'super_admin' or (target_college_id is not null and p.college_id = target_college_id))
  );
$$;

create function app_private.is_super_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'super_admin'
      and p.verification_status = 'approved'
      and p.suspended_at is null
  );
$$;

create function app_private.can_read_product_image(object_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.product_images i
    join public.products p on p.id = i.product_id
    where i.storage_path = object_name
      and (
        p.seller_id = (select auth.uid())
        or (p.status = 'approved' and app_private.is_approved_member(p.college_id))
        or app_private.is_college_admin(p.college_id)
      )
  );
$$;

create function app_private.can_review_verification_document(object_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_verifications v
    where v.id_document_path = object_name
      and app_private.is_college_admin(v.college_id)
  );
$$;

create function app_private.can_upload_verification_document(object_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select split_part(object_name, '/', 1) = (select auth.uid())::text
    and object_name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|pdf)$'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.verification_status in ('not_submitted', 'rejected')
        and p.suspended_at is null
    );
$$;

create function app_private.can_upload_product_image(object_name text)
returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
declare
  product_folder text := split_part(object_name, '/', 2);
  product_uuid uuid;
begin
  if split_part(object_name, '/', 1) <> (select auth.uid())::text
     or product_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  product_uuid := product_folder::uuid;
  return exists (
    select 1 from public.products p
    where p.id = product_uuid
      and p.seller_id = (select auth.uid())
      and p.status in ('draft', 'pending', 'rejected')
      and app_private.is_approved_member(p.college_id)
  );
end;
$$;

grant execute on function app_private.is_approved_member(uuid) to authenticated;
grant execute on function app_private.is_college_admin(uuid) to authenticated;
grant execute on function app_private.is_super_admin() to authenticated;
grant execute on function app_private.can_read_product_image(text) to authenticated;
grant execute on function app_private.can_review_verification_document(text) to authenticated;
grant execute on function app_private.can_upload_verification_document(text) to authenticated;
grant execute on function app_private.can_upload_product_image(text) to authenticated;

create function app_private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  safe_name text;
  safe_role public.community_role;
begin
  safe_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Campus member'), 120);
  safe_role := case new.raw_user_meta_data ->> 'role'
    when 'faculty' then 'faculty'::public.community_role
    when 'staff' then 'staff'::public.community_role
    else 'student'::public.community_role
  end;
  insert into public.profiles (id, full_name, handle, role)
  values (new.id, safe_name, 'member-' || left(replace(new.id::text, '-', ''), 12), safe_role)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create function app_private.validate_verification_submission()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  verified_email text;
  email_domain text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and new.user_id is distinct from (select auth.uid()) then
    raise exception 'A user may only submit their own verification';
  end if;
  if new.status <> 'pending' or new.reviewer_id is not null or new.reviewed_at is not null then
    raise exception 'Verification submissions must begin in pending status';
  end if;

  select lower(u.email) into verified_email
  from auth.users u
  where u.id = new.user_id and u.email_confirmed_at is not null;
  if verified_email is null or verified_email <> lower(trim(new.college_email)) then
    raise exception 'The college email must match the verified account email';
  end if;

  email_domain := split_part(verified_email, '@', 2);
  if not exists (
    select 1 from public.colleges c
    where c.id = new.college_id and c.is_active
      and exists (
        select 1 from unnest(c.email_domains) as domains(domain_name)
        where lower(trim(domains.domain_name)) = email_domain
      )
  ) then
    raise exception 'This email domain is not approved for the selected college';
  end if;
  if split_part(new.id_document_path, '/', 1) <> new.user_id::text then
    raise exception 'Verification documents must be stored in the user private folder';
  end if;
  return new;
end;
$$;
create trigger validate_verification_submission
  before insert on public.user_verifications
  for each row execute function app_private.validate_verification_submission();

create function app_private.mark_profile_pending()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.profile_privileged_update', 'allowed', true);
  update public.profiles
  set college_id = new.college_id, verification_status = 'pending', updated_at = now()
  where id = new.user_id;
  perform set_config('app.profile_privileged_update', '', true);
  return new;
end;
$$;
create trigger verification_submission_updates_profile
  after insert on public.user_verifications
  for each row execute function app_private.mark_profile_pending();

create function public.review_verification(
  p_verification_id uuid,
  p_decision public.verification_status,
  p_rejection_reason text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  item public.user_verifications%rowtype;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  select * into item from public.user_verifications
  where id = p_verification_id for update;
  if not found or item.status <> 'pending' then
    raise exception 'Pending verification was not found';
  end if;
  if not app_private.is_college_admin(item.college_id) then
    raise exception 'Not authorized to review this college verification';
  end if;

  update public.user_verifications
  set status = p_decision,
      reviewer_id = (select auth.uid()),
      reviewed_at = now(),
      rejection_reason = case when p_decision = 'rejected' then left(coalesce(p_rejection_reason, ''), 1000) else null end,
      updated_at = now()
  where id = item.id;

  perform set_config('app.profile_privileged_update', 'allowed', true);
  update public.profiles
  set college_id = item.college_id,
      role = case when p_decision = 'approved' then item.requested_role else role end,
      verification_status = p_decision,
      updated_at = now()
  where id = item.user_id;
  perform set_config('app.profile_privileged_update', '', true);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    (select auth.uid()), 'verification_' || p_decision::text, 'user_verification', item.id,
    jsonb_build_object('status', item.status),
    jsonb_build_object('status', p_decision, 'user_id', item.user_id, 'college_id', item.college_id)
  );
  insert into public.notifications (user_id, kind, title, body, payload)
  values (
    item.user_id, 'verification',
    case when p_decision = 'approved' then 'Campus identity approved' else 'Verification needs an update' end,
    case when p_decision = 'approved' then 'Your LOOPEC account is ready to use.' else coalesce(nullif(trim(p_rejection_reason), ''), 'Open your verification page to review the decision.') end,
    jsonb_build_object('status', p_decision, 'verification_id', item.id)
  );
end;
$$;

create function public.submit_product(p_product_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.products p
  set status = 'pending', updated_at = now()
  where p.id = p_product_id
    and p.seller_id = (select auth.uid())
    and p.status in ('draft', 'rejected')
    and app_private.is_approved_member(p.college_id);
  if not found then raise exception 'Product cannot be submitted'; end if;
end;
$$;

create function public.withdraw_product(p_product_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  item public.products%rowtype;
begin
  if actor_id is null then raise exception 'A signed-in member is required'; end if;
  select * into item from public.products where id = p_product_id for update;
  if not found or item.seller_id <> actor_id or item.status <> 'approved'
     or not app_private.is_approved_member(item.college_id) then
    raise exception 'This listing cannot be removed from this account';
  end if;
  if exists (
    select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
    where oi.product_id = item.id and o.status in ('pending', 'accepted', 'payment_pending', 'paid', 'ready_for_pickup')
  ) then raise exception 'Resolve open orders before removing this listing'; end if;

  update public.products set status = 'removed', updated_at = now() where id = item.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (actor_id, 'product_withdrawn', 'product', item.id,
    jsonb_build_object('status', item.status), jsonb_build_object('status', 'removed'));
end;
$$;

create function public.moderate_product(
  p_product_id uuid,
  p_decision public.product_status,
  p_moderator_notes text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  item public.products%rowtype;
begin
  if p_decision not in ('approved', 'rejected', 'removed') then
    raise exception 'Invalid moderation decision';
  end if;
  if p_decision = 'rejected' and char_length(trim(coalesce(p_moderator_notes, ''))) < 5 then
    raise exception 'A clear reason is required when rejecting a listing';
  end if;
  select * into item from public.products where id = p_product_id for update;
  if not found or not app_private.is_college_admin(item.college_id) then
    raise exception 'Not authorized to moderate this product';
  end if;
  if p_decision in ('approved', 'rejected') and item.status not in ('pending', 'rejected') then
    raise exception 'Product is not awaiting moderation';
  end if;
  update public.products
  set status = p_decision,
      published_at = case when p_decision = 'approved' then coalesce(published_at, now()) else published_at end,
      moderation_notes = case when p_decision = 'rejected' then left(trim(p_moderator_notes), 1000) else null end,
      moderated_by = (select auth.uid()),
      moderated_at = now(),
      updated_at = now()
  where id = item.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    (select auth.uid()), 'product_' || p_decision::text, 'product', item.id,
    jsonb_build_object('status', item.status),
    jsonb_build_object('status', p_decision, 'moderator_notes', case when p_decision = 'rejected' then left(trim(p_moderator_notes), 1000) else null end)
  );
  insert into public.notifications (user_id, kind, title, body, payload)
  values (
    item.seller_id, 'listing_status',
    case when p_decision = 'approved' then 'Listing approved' else 'Listing needs an update' end,
    case when p_decision = 'approved' then item.name || ' is now visible to your campus.' else coalesce(nullif(trim(p_moderator_notes), ''), item.name || ' needs a change before it can be listed.') end,
    jsonb_build_object('status', p_decision, 'product_id', item.id)
  );
end;
$$;

create function app_private.validate_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  item public.orders%rowtype;
begin
  select * into item from public.orders where id = new.order_id;
  if not found or item.status <> 'completed' then raise exception 'Only completed orders can be reviewed'; end if;
  if not (
    (new.reviewer_id = item.buyer_id and new.reviewed_user_id = item.seller_id)
    or (new.reviewer_id = item.seller_id and new.reviewed_user_id = item.buyer_id)
  ) then raise exception 'Review participants must belong to the completed order'; end if;
  return new;
end;
$$;
create trigger validate_review_participants
  before insert on public.reviews for each row execute function app_private.validate_review();

create function app_private.validate_message_sender()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.conversations c
    where c.id = new.conversation_id
      and new.sender_id in (c.buyer_id, c.seller_id)
      and app_private.is_approved_member(c.college_id)
  ) then raise exception 'Only verified conversation participants may send messages'; end if;
  return new;
end;
$$;
create trigger validate_message_sender
  before insert on public.messages for each row execute function app_private.validate_message_sender();

create function app_private.touch_conversation_after_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  conversation public.conversations%rowtype;
  recipient_id uuid;
begin
  update public.conversations set updated_at = now()
  where id = new.conversation_id returning * into conversation;
  if conversation.buyer_id = new.sender_id then recipient_id := conversation.seller_id;
  else recipient_id := conversation.buyer_id;
  end if;
  insert into public.notifications (user_id, kind, title, body, payload)
  values (recipient_id, 'new_message', 'New message', 'You have a new private message.', jsonb_build_object('conversation_id', conversation.id));
  return new;
end;
$$;
create trigger message_updates_conversation
  after insert on public.messages for each row execute function app_private.touch_conversation_after_message();

create function app_private.validate_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  other_user_id uuid;
begin
  if new.buyer_id = new.seller_id then raise exception 'Conversation participants must be different users'; end if;
  if (select auth.uid()) not in (new.buyer_id, new.seller_id) then
    raise exception 'Only a conversation participant may start a conversation';
  end if;
  other_user_id := case when new.buyer_id = (select auth.uid()) then new.seller_id else new.buyer_id end;
  if not app_private.is_approved_member(new.college_id) or not exists (
    select 1 from public.profiles p where p.id = other_user_id
      and p.college_id = new.college_id and p.verification_status = 'approved'
      and p.suspended_at is null
  ) then raise exception 'Both conversation participants must be approved members of the same college'; end if;
  if new.product_id is not null and not exists (
    select 1 from public.products p where p.id = new.product_id and p.seller_id = new.seller_id
      and p.college_id = new.college_id and p.status = 'approved'
  ) then raise exception 'Conversation product must be an approved listing from the seller'; end if;
  if new.order_id is not null and not exists (
    select 1 from public.orders o where o.id = new.order_id and o.buyer_id = new.buyer_id
      and o.seller_id = new.seller_id and o.college_id = new.college_id
  ) then raise exception 'Conversation order must belong to both participants'; end if;
  return new;
end;
$$;
create trigger validate_conversation_participants
  before insert on public.conversations for each row execute function app_private.validate_conversation();

create function app_private.validate_report_target()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  reporter_college uuid;
begin
  select p.college_id into reporter_college from public.profiles p
  where p.id = new.reporter_id and p.verification_status = 'approved' and p.suspended_at is null;
  if reporter_college is null then raise exception 'Reporter must be an approved member'; end if;
  if new.reported_user_id is not null and not exists (
    select 1 from public.profiles p where p.id = new.reported_user_id and p.college_id = reporter_college
  ) then raise exception 'Reported user must belong to the reporter college'; end if;
  if new.product_id is not null and not exists (
    select 1 from public.products p where p.id = new.product_id and p.college_id = reporter_college
  ) then raise exception 'Reported product must belong to the reporter college'; end if;
  return new;
end;
$$;
create trigger validate_report_target
  before insert on public.reports for each row execute function app_private.validate_report_target();

-- The public RPC authorizes transitions and uses a transaction-local flag for the guard trigger.
create function app_private.guard_order_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status
     and current_setting('app.order_transition', true) is distinct from 'allowed' then
    raise exception 'Use transition_order_status to change order status';
  end if;
  return new;
end;
$$;
create trigger guard_order_status_changes
  before update on public.orders for each row execute function app_private.guard_order_status_change();

create function app_private.release_order_inventory()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status
     and new.status in ('rejected', 'cancelled', 'refunded') then
    update public.products p
    set quantity = p.quantity + oi.quantity,
        status = case when p.status = 'sold' then 'approved'::public.product_status else p.status end,
        updated_at = now()
    from public.order_items oi
    where oi.order_id = new.id and p.id = oi.product_id;
  end if;
  return new;
end;
$$;
create trigger release_inventory_on_order_close
  after update on public.orders for each row execute function app_private.release_order_inventory();

create function app_private.notify_new_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, kind, title, body, payload)
  values (
    new.seller_id, 'new_order', 'New campus order',
    'A member placed an order. Review the items and pickup details.',
    jsonb_build_object('order_id', new.id)
  );
  return new;
end;
$$;
create trigger notify_seller_on_new_order
  after insert on public.orders for each row execute function app_private.notify_new_order();

create function public.transition_order_status(
  p_order_id uuid,
  p_next_status public.order_status
)
returns public.orders
language plpgsql security definer
set search_path = ''
as $$
declare
  item public.orders%rowtype;
  payment_item public.payments%rowtype;
  actor_id uuid := (select auth.uid());
  trusted_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  trusted_admin boolean := false;
  allowed boolean := false;
  old_status public.order_status;
begin
  select * into item from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if not trusted_service and not app_private.is_approved_member(item.college_id) then
    raise exception 'Only active verified members may update this order';
  end if;
  old_status := item.status;

  if trusted_service then
    allowed := (item.status = 'payment_pending' and p_next_status = 'paid')
      or (item.status = 'paid' and p_next_status = 'refunded');
  elsif actor_id = item.buyer_id then
    allowed := (item.status in ('pending', 'accepted') and p_next_status = 'cancelled')
      or (item.status = 'payment_pending' and p_next_status = 'cancelled'
        and not exists (select 1 from public.payments pay where pay.order_id = item.id and pay.provider_payment_id is not null))
      or (item.status = 'accepted' and p_next_status = 'payment_pending')
      or (item.status = 'ready_for_pickup' and p_next_status = 'completed');
  elsif actor_id = item.seller_id then
    allowed := (item.status = 'pending' and p_next_status in ('accepted', 'rejected'))
      or (item.status = 'paid' and p_next_status = 'ready_for_pickup')
      or (item.status = 'ready_for_pickup' and p_next_status = 'completed');
  elsif app_private.is_college_admin(item.college_id) then
    trusted_admin := true;
    allowed := (item.status in ('pending', 'accepted') and p_next_status = 'cancelled')
      or (item.status = 'payment_pending' and p_next_status = 'cancelled'
        and not exists (select 1 from public.payments pay where pay.order_id = item.id and pay.provider_payment_id is not null))
      or (item.status = 'payment_pending' and p_next_status = 'paid');
    if item.status = 'payment_pending' and p_next_status = 'paid' then
      select * into payment_item from public.payments
      where order_id = item.id and status = 'pending'
      order by created_at desc limit 1 for update;
      if not found or payment_item.method <> 'manual_upi' or payment_item.provider_payment_id is null then
        raise exception 'A submitted manual payment reference is required before verification';
      end if;
    end if;
  end if;
  if not allowed then raise exception 'Invalid or unauthorized order status transition'; end if;

  -- Campus handover is complete only after both participants confirm it.
  if p_next_status = 'completed' and old_status = 'ready_for_pickup' then
    if actor_id = item.buyer_id then
      update public.orders set buyer_confirmed_at = coalesce(buyer_confirmed_at, now()), updated_at = now()
      where id = item.id returning * into item;
    elsif actor_id = item.seller_id then
      update public.orders set seller_confirmed_at = coalesce(seller_confirmed_at, now()), updated_at = now()
      where id = item.id returning * into item;
    end if;
    if item.buyer_confirmed_at is null or item.seller_confirmed_at is null then
      return item;
    end if;
  end if;

  perform set_config('app.order_transition', 'allowed', true);
  update public.orders set status = p_next_status, updated_at = now()
  where id = item.id returning * into item;
  perform set_config('app.order_transition', '', true);

  if p_next_status = 'paid' then
    if trusted_admin then
      update public.payments
      set status = 'paid', verified_at = now(), updated_at = now()
      where id = payment_item.id returning * into payment_item;
    else
      select * into payment_item from public.payments
      where order_id = item.id and status = 'pending'
      order by created_at desc limit 1 for update;
      if not found then raise exception 'Pending payment record was not found'; end if;
      update public.payments
      set status = 'paid', verified_at = now(), updated_at = now()
      where id = payment_item.id returning * into payment_item;
    end if;
    insert into public.transactions (
      order_id, payment_id, transaction_type, gross_amount,
      commission_amount, seller_net_amount, currency, idempotency_key
    ) values (
      item.id, payment_item.id, 'payment', payment_item.amount,
      item.commission_amount, greatest(payment_item.amount - item.commission_amount, 0),
      payment_item.currency, 'payment:' || payment_item.id::text
    ) on conflict (idempotency_key) do nothing;
  elsif p_next_status = 'refunded' then
    select * into payment_item from public.payments
    where order_id = item.id and status = 'paid'
    order by created_at desc limit 1 for update;
    if found then
    update public.payments
    set status = 'refunded', verified_at = now(), updated_at = now()
      where id = payment_item.id returning * into payment_item;
      insert into public.transactions (
        order_id, payment_id, transaction_type, gross_amount,
        commission_amount, seller_net_amount, currency, idempotency_key
      ) values (
        item.id, payment_item.id, 'refund', payment_item.amount,
        0, payment_item.amount, payment_item.currency, 'refund:' || payment_item.id::text
      ) on conflict (idempotency_key) do nothing;
    end if;
  elsif p_next_status in ('cancelled', 'rejected') then
    update public.payments set status = 'failed', updated_at = now()
    where order_id = item.id and status = 'pending';
  end if;

  if (p_next_status in ('cancelled', 'refunded') and not trusted_service)
     or (p_next_status = 'paid' and trusted_admin)
     or p_next_status = 'completed' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
    values (actor_id, case when p_next_status = 'paid' then 'manual_payment_verified' else 'order_' || p_next_status::text end, 'order', item.id,
      jsonb_build_object('status', old_status),
      jsonb_build_object('status', p_next_status, 'payment_id', case when p_next_status = 'paid' then payment_item.id else null end));
  end if;
  insert into public.notifications (user_id, kind, title, body, payload)
  select recipient.user_id, 'order_status', 'Order update',
    case p_next_status
      when 'accepted' then 'The seller accepted your order.'
      when 'rejected' then 'The seller declined the order.'
      when 'payment_pending' then 'The order is waiting for manual payment review.'
      when 'paid' then 'Payment was verified for the order.'
      when 'ready_for_pickup' then 'The seller marked the order ready for pickup.'
      when 'completed' then 'Both members confirmed the campus handover.'
      when 'cancelled' then 'The order was cancelled.'
      when 'refunded' then 'The order was refunded.'
      else 'Your order status changed.'
    end,
    jsonb_build_object('order_id', item.id, 'status', p_next_status)
  from (values (item.buyer_id), (item.seller_id)) as recipient(user_id)
  where recipient.user_id is distinct from actor_id;
  return item;
end;
$$;

create function public.create_checkout_orders(
  p_pickup_location_id uuid,
  p_idempotency_key uuid
)
returns setof uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  member_college_id uuid;
  pickup public.pickup_locations%rowtype;
  line record;
  seller_record record;
  new_order_id uuid;
  subtotal_amount numeric(12,2);
  commission_percent numeric(5,2);
  commission_amount_value numeric(12,2);
  cart_line_count integer := 0;
begin
  if actor_id is null or p_idempotency_key is null then
    raise exception 'A signed-in member and checkout key are required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::text || ':' || p_idempotency_key::text, 0));
  select college_id into member_college_id
  from public.profiles
  where id = actor_id and verification_status = 'approved' and suspended_at is null;
  if member_college_id is null then raise exception 'Only approved campus members can check out'; end if;

  if exists (
    select 1 from public.payments pay join public.orders o on o.id = pay.order_id
    where o.buyer_id = actor_id and pay.idempotency_key like p_idempotency_key::text || ':%'
  ) then
    return query
    select o.id from public.payments pay join public.orders o on o.id = pay.order_id
    where o.buyer_id = actor_id and pay.idempotency_key like p_idempotency_key::text || ':%'
    order by o.created_at;
    return;
  end if;

  select * into pickup from public.pickup_locations
  where id = p_pickup_location_id and college_id = member_college_id and is_active;
  if not found then raise exception 'Choose an active pickup point for your college'; end if;

  for line in
    select c.product_id, c.quantity, p.seller_id, p.college_id, p.status, p.price, p.quantity as available_quantity
    from public.cart_items c join public.products p on p.id = c.product_id
    where c.user_id = actor_id order by p.seller_id, p.id
    for update of c, p
  loop
    cart_line_count := cart_line_count + 1;
    if line.college_id <> member_college_id or line.seller_id = actor_id
       or line.status <> 'approved' or line.available_quantity < line.quantity then
      raise exception 'A cart item changed or is no longer available';
    end if;
  end loop;
  if cart_line_count = 0 then raise exception 'Your cart is empty'; end if;

  select coalesce((value #>> '{}')::numeric, 5) into commission_percent
  from public.platform_settings where key = 'default_commission_percent';
  commission_percent := coalesce(commission_percent, 5);
  if commission_percent < 0 or commission_percent > 100 then
    raise exception 'The configured commission rate is invalid';
  end if;

  for seller_record in
    select distinct p.seller_id
    from public.cart_items c join public.products p on p.id = c.product_id
    where c.user_id = actor_id order by p.seller_id
  loop
    select round(sum(p.price * c.quantity)::numeric, 2) into subtotal_amount
    from public.cart_items c join public.products p on p.id = c.product_id
    where c.user_id = actor_id and p.seller_id = seller_record.seller_id;
    commission_amount_value := round(subtotal_amount * commission_percent / 100, 2);

    insert into public.orders (
      college_id, buyer_id, seller_id, pickup_location_id, status,
      subtotal, commission_amount, total_amount, currency
    ) values (
      member_college_id, actor_id, seller_record.seller_id, pickup.id, 'pending',
      subtotal_amount, commission_amount_value, subtotal_amount, 'INR'
    ) returning id into new_order_id;

    for line in
      select p.id, p.name, p.price, p.quantity, c.quantity as ordered_quantity
      from public.cart_items c join public.products p on p.id = c.product_id
      where c.user_id = actor_id and p.seller_id = seller_record.seller_id
      order by p.id
    loop
      update public.products
      set quantity = quantity - line.ordered_quantity,
          status = case when quantity - line.ordered_quantity = 0 then 'sold'::public.product_status else status end,
          updated_at = now()
      where id = line.id and status = 'approved' and quantity >= line.ordered_quantity;
      if not found then raise exception 'A cart item sold before checkout completed'; end if;

      insert into public.order_items (
        order_id, product_id, product_name, unit_price, quantity, line_total
      ) values (
        new_order_id, line.id, line.name, line.price,
        line.ordered_quantity, line.price * line.ordered_quantity
      );
    end loop;

    insert into public.payments (
      order_id, provider, method, status, amount, currency, idempotency_key
    ) values (
      new_order_id, 'manual_upi', 'manual_upi', 'pending', subtotal_amount, 'INR',
      p_idempotency_key::text || ':' || seller_record.seller_id::text
    );

    insert into public.conversations (college_id, buyer_id, seller_id, order_id)
    values (member_college_id, actor_id, seller_record.seller_id, new_order_id)
    on conflict (buyer_id, seller_id, order_id) where order_id is not null do nothing;

    return next new_order_id;
  end loop;

  delete from public.cart_items where user_id = actor_id;
end;
$$;

create function public.create_single_checkout_order(
  p_product_id uuid,
  p_pickup_location_id uuid,
  p_idempotency_key uuid
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  member_college_id uuid;
  item public.products%rowtype;
  pickup public.pickup_locations%rowtype;
  existing_order_id uuid;
  new_order_id uuid;
  commission_percent numeric(5,2);
  commission_amount_value numeric(12,2);
begin
  if actor_id is null or p_idempotency_key is null then
    raise exception 'A signed-in member and checkout key are required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::text || ':' || p_idempotency_key::text, 0));
  select college_id into member_college_id from public.profiles
  where id = actor_id and verification_status = 'approved' and suspended_at is null;
  if member_college_id is null then raise exception 'Only approved campus members can check out'; end if;

  select o.id into existing_order_id
  from public.payments pay join public.orders o on o.id = pay.order_id
  where o.buyer_id = actor_id and pay.idempotency_key = p_idempotency_key::text || ':' || o.seller_id::text
  limit 1;
  if existing_order_id is not null then return existing_order_id; end if;

  select * into item from public.products where id = p_product_id for update;
  if not found or item.college_id <> member_college_id or item.seller_id = actor_id
     or item.status <> 'approved' or item.quantity < 1 then
    raise exception 'This listing is no longer available';
  end if;
  select * into pickup from public.pickup_locations
  where id = p_pickup_location_id and college_id = member_college_id and is_active;
  if not found then raise exception 'Choose an active pickup point for your college'; end if;

  select coalesce((value #>> '{}')::numeric, 5) into commission_percent
  from public.platform_settings where key = 'default_commission_percent';
  commission_percent := coalesce(commission_percent, 5);
  if commission_percent < 0 or commission_percent > 100 then raise exception 'The configured commission rate is invalid'; end if;
  commission_amount_value := round(item.price * commission_percent / 100, 2);

  insert into public.orders (
    college_id, buyer_id, seller_id, pickup_location_id, status,
    subtotal, commission_amount, total_amount, currency
  ) values (
    member_college_id, actor_id, item.seller_id, pickup.id, 'pending',
    item.price, commission_amount_value, item.price, 'INR'
  ) returning id into new_order_id;
  update public.products
  set quantity = quantity - 1,
      status = case when quantity = 1 then 'sold'::public.product_status else status end,
      updated_at = now()
  where id = item.id and status = 'approved' and quantity > 0;
  if not found then raise exception 'This listing sold before checkout completed'; end if;
  insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
  values (new_order_id, item.id, item.name, item.price, 1, item.price);
  insert into public.payments (order_id, provider, method, status, amount, currency, idempotency_key)
  values (
    new_order_id, 'manual_upi', 'manual_upi', 'pending', item.price, 'INR',
    p_idempotency_key::text || ':' || item.seller_id::text
  );
  insert into public.conversations (college_id, buyer_id, seller_id, order_id)
  values (member_college_id, actor_id, item.seller_id, new_order_id)
  on conflict (buyer_id, seller_id, order_id) where order_id is not null do nothing;
  return new_order_id;
end;
$$;

create function public.submit_manual_payment_reference(
  p_order_id uuid,
  p_reference text
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  clean_reference text := upper(trim(coalesce(p_reference, '')));
  payment_row public.payments%rowtype;
begin
  if actor_id is null or clean_reference !~ '^[A-Z0-9-]{6,50}$' then
    raise exception 'Enter a valid UPI payment reference';
  end if;
  if not exists (
    select 1 from public.orders o join public.profiles p on p.id = o.buyer_id
    where o.id = p_order_id and o.buyer_id = actor_id and o.status = 'payment_pending'
      and p.verification_status = 'approved' and p.suspended_at is null
  ) then raise exception 'This order is not accepting a payment reference'; end if;
  select * into payment_row from public.payments
  where order_id = p_order_id and method = 'manual_upi' and status in ('pending', 'failed')
  order by created_at desc limit 1 for update;
  if not found then raise exception 'Pending manual payment was not found'; end if;

  update public.payments set provider_payment_id = clean_reference, status = 'pending',
    review_note = null, reviewed_by = null, reviewed_at = null, updated_at = now()
  where id = payment_row.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (actor_id, 'manual_payment_reference_submitted', 'order', p_order_id,
    jsonb_build_object('reference_submitted', false), jsonb_build_object('reference_submitted', true));
end;
$$;

create function public.reject_manual_payment_reference(
  p_order_id uuid,
  p_reason text
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  reviewer_id uuid := (select auth.uid());
  payment_row public.payments%rowtype;
  clean_reason text := left(trim(coalesce(p_reason, '')), 1000);
begin
  if char_length(clean_reason) < 5 then raise exception 'Provide a clear reason for rejecting the reference'; end if;
  if not exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.status = 'payment_pending'
      and app_private.is_college_admin(o.college_id)
  ) then raise exception 'Not authorized to review this payment'; end if;
  select * into payment_row from public.payments
  where order_id = p_order_id and method = 'manual_upi' and status = 'pending'
    and provider_payment_id is not null
  order by created_at desc limit 1 for update;
  if not found then raise exception 'Submitted payment reference was not found'; end if;

  update public.payments
  set status = 'failed', provider_payment_id = null, review_note = clean_reason,
      reviewed_by = reviewer_id, reviewed_at = now(), updated_at = now()
  where id = payment_row.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (reviewer_id, 'manual_payment_reference_rejected', 'order', p_order_id,
    jsonb_build_object('status', payment_row.status, 'reference_submitted', true),
    jsonb_build_object('status', 'failed', 'reason', clean_reason));
end;
$$;

create function public.set_member_suspension(
  p_user_id uuid,
  p_suspend boolean,
  p_reason text default null
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  target public.profiles%rowtype;
  clean_reason text := left(trim(coalesce(p_reason, '')), 1000);
begin
  if actor_id is null or p_user_id = actor_id then
    raise exception 'Administrators cannot change their own member access';
  end if;
  select * into target from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Member profile was not found'; end if;
  if target.role in ('college_admin', 'super_admin') then
    raise exception 'Use an owner-level account to change administrator access';
  end if;
  if not app_private.is_college_admin(target.college_id) then
    raise exception 'Not authorized to manage this member';
  end if;
  if p_suspend and char_length(clean_reason) < 5 then
    raise exception 'Provide a clear reason for suspending a member';
  end if;
  if p_suspend and target.suspended_at is not null then return; end if;
  if not p_suspend and target.suspended_at is null then return; end if;

  perform set_config('app.profile_privileged_update', 'allowed', true);
  update public.profiles set suspended_at = case when p_suspend then now() else null end, updated_at = now()
  where id = p_user_id;
  perform set_config('app.profile_privileged_update', '', true);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    actor_id,
    case when p_suspend then 'member_suspended' else 'member_reinstated' end,
    'profile', p_user_id,
    jsonb_build_object('suspended', target.suspended_at is not null),
    jsonb_build_object('suspended', p_suspend, 'reason', nullif(clean_reason, ''))
  );
  insert into public.notifications (user_id, kind, title, body, payload)
  values (
    p_user_id, 'system',
    case when p_suspend then 'Account access changed' else 'Account access restored' end,
    case when p_suspend then 'Your account was suspended. Contact your college administrator for details.' else 'Your LOOPEC account access has been restored.' end,
    jsonb_build_object('suspended', p_suspend)
  );
end;
$$;

create function public.seller_dashboard_metrics()
returns table (
  total_listings bigint,
  active_listings bigint,
  pending_listings bigint,
  pending_orders bigint,
  completed_orders bigint,
  paid_sales numeric,
  review_count bigint,
  average_rating numeric
)
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null or not exists (
    select 1 from public.profiles p
    where p.id = actor_id and app_private.is_approved_member(p.college_id)
  ) then raise exception 'An approved member session is required'; end if;

  return query select
    (select count(*) from public.products p where p.seller_id = actor_id),
    (select count(*) from public.products p where p.seller_id = actor_id and p.status = 'approved'),
    (select count(*) from public.products p where p.seller_id = actor_id and p.status = 'pending'),
    (select count(*) from public.orders o where o.seller_id = actor_id and o.status = 'pending'),
    (select count(*) from public.orders o where o.seller_id = actor_id and o.status = 'completed'),
    coalesce((
      select sum(t.seller_net_amount) from public.transactions t
      join public.orders o on o.id = t.order_id
      where o.seller_id = actor_id and t.transaction_type = 'payment'
    ), 0),
    (select count(*) from public.reviews r where r.reviewed_user_id = actor_id),
    (select avg(r.rating)::numeric from public.reviews r where r.reviewed_user_id = actor_id);
end;
$$;

create function public.review_report(
  p_report_id uuid,
  p_decision public.report_status,
  p_moderator_notes text default null
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  item public.reports%rowtype;
  reporter_college uuid;
  clean_notes text := left(trim(coalesce(p_moderator_notes, '')), 2000);
begin
  if p_decision not in ('under_review', 'resolved', 'dismissed') then
    raise exception 'Invalid report decision';
  end if;
  select * into item from public.reports where id = p_report_id for update;
  if not found or item.status in ('resolved', 'dismissed') then raise exception 'Open report was not found'; end if;
  select college_id into reporter_college from public.profiles where id = item.reporter_id;
  if not app_private.is_college_admin(reporter_college) then raise exception 'Not authorized to review this report'; end if;

  update public.reports
  set status = p_decision, moderator_id = (select auth.uid()),
      moderator_notes = nullif(clean_notes, ''), updated_at = now()
  where id = item.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values ((select auth.uid()), 'report_' || p_decision::text, 'report', item.id,
    jsonb_build_object('status', item.status),
    jsonb_build_object('status', p_decision, 'moderator_notes', nullif(clean_notes, '')));
  insert into public.notifications (user_id, kind, title, body, payload)
  values (item.reporter_id, 'system', 'Report reviewed', 'Your campus safety report has been updated.', jsonb_build_object('status', p_decision, 'report_id', item.id));
end;
$$;

create function public.update_commission_percent(p_percent numeric)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  old_value jsonb;
begin
  if not app_private.is_super_admin() then raise exception 'Only a super admin can change the platform commission'; end if;
  if p_percent is null or p_percent < 0 or p_percent > 100 then raise exception 'Commission must be between 0 and 100 percent'; end if;
  select value into old_value from public.platform_settings where key = 'default_commission_percent' for update;
  if not found then raise exception 'Commission setting was not found'; end if;
  update public.platform_settings
  set value = to_jsonb(round(p_percent, 2)), updated_by = actor_id, updated_at = now()
  where key = 'default_commission_percent';
  insert into public.audit_logs (actor_id, action, entity_type, before_data, after_data)
  values (actor_id, 'commission_updated', 'platform_setting',
    jsonb_build_object('key', 'default_commission_percent', 'value', old_value),
    jsonb_build_object('key', 'default_commission_percent', 'value', to_jsonb(round(p_percent, 2))));
end;
$$;

create function app_private.guard_profile_privileged_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null
     and current_setting('app.profile_privileged_update', true) is distinct from 'allowed'
     and (new.role is distinct from old.role
     or new.college_id is distinct from old.college_id
     or new.verification_status is distinct from old.verification_status
     or new.suspended_at is distinct from old.suspended_at) then
    raise exception 'Privileged profile fields may only be changed by trusted workflows';
  end if;
  return new;
end;
$$;
create trigger guard_profile_privileged_fields
  before update on public.profiles for each row execute function app_private.guard_profile_privileged_fields();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'colleges', 'profiles', 'user_verifications', 'categories', 'products', 'cart_items',
    'pickup_locations', 'orders', 'payments', 'conversations', 'reports', 'platform_settings'
  ] loop
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function app_private.touch_updated_at()', table_name, table_name);
  end loop;
end;
$$;

-- Private buckets: never put verification documents in public storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('verification-documents', 'verification-documents', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf']),
  ('product-images', 'product-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.colleges enable row level security;
alter table public.profiles enable row level security;
alter table public.user_verifications enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.wishlists enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.transactions enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;
alter table public.pickup_locations enable row level security;
alter table public.platform_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy "Active colleges are visible" on public.colleges
  for select to anon, authenticated using (is_active);
create policy "Categories are visible" on public.categories
  for select to authenticated using (is_active or app_private.is_college_admin(null));
create policy "Admins manage categories" on public.categories
  for all to authenticated using (app_private.is_college_admin(null)) with check (app_private.is_college_admin(null));

create policy "Profiles visible to owner community and admins" on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or app_private.is_approved_member(college_id)
    or app_private.is_college_admin(college_id)
  );
create policy "Owners update their profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Users read own verification and admins review college" on public.user_verifications
  for select to authenticated using (
    user_id = (select auth.uid()) or app_private.is_college_admin(college_id)
  );
create policy "Users submit their own verification" on public.user_verifications
  for insert to authenticated with check (
    user_id = (select auth.uid()) and status = 'pending'
  );

create policy "Approved members read marketplace listings" on public.products
  for select to authenticated using (
    (status = 'approved' and app_private.is_approved_member(college_id))
    or seller_id = (select auth.uid())
    or app_private.is_college_admin(college_id)
  );
create policy "Approved members create their listings" on public.products
  for insert to authenticated with check (
    seller_id = (select auth.uid())
    and status = 'draft'
    and app_private.is_approved_member(college_id)
    and exists (select 1 from public.categories c where c.id = category_id and c.is_active)
  );
create policy "Sellers update their listings" on public.products
  for update to authenticated using (
    seller_id = (select auth.uid()) and status in ('draft', 'rejected')
  ) with check (
    seller_id = (select auth.uid()) and app_private.is_approved_member(college_id)
  );
create policy "Sellers remove drafts and admins remove listings" on public.products
  for delete to authenticated using (
    (seller_id = (select auth.uid()) and status in ('draft', 'rejected'))
    or app_private.is_college_admin(college_id)
  );
create policy "Admins update listings" on public.products
  for update to authenticated using (app_private.is_college_admin(college_id))
  with check (app_private.is_college_admin(college_id));

create policy "Product images follow product visibility" on public.product_images
  for select to authenticated using (
    exists (
      select 1 from public.products p where p.id = product_id
      and (p.seller_id = (select auth.uid())
        or (p.status = 'approved' and app_private.is_approved_member(p.college_id))
        or app_private.is_college_admin(p.college_id))
    )
  );
create policy "Sellers add images to their drafts" on public.product_images
  for insert to authenticated with check (
    exists (
      select 1 from public.products p where p.id = product_id
      and p.seller_id = (select auth.uid()) and p.status in ('draft', 'rejected')
      and app_private.is_approved_member(p.college_id)
    )
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );
create policy "Sellers remove images from their drafts" on public.product_images
  for delete to authenticated using (
    exists (
      select 1 from public.products p where p.id = product_id
      and p.seller_id = (select auth.uid()) and p.status in ('draft', 'rejected')
    )
  );

create policy "Owners manage their wishlists" on public.wishlists
  for all to authenticated using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.products p where p.id = product_id and p.status = 'approved'
      and app_private.is_approved_member(p.college_id))
  );
create policy "Owners manage their cart" on public.cart_items
  for all to authenticated using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.products p where p.id = product_id and p.status = 'approved'
      and p.quantity >= public.cart_items.quantity and p.seller_id <> (select auth.uid())
      and app_private.is_approved_member(p.college_id))
  );

create policy "Order participants and admins view orders" on public.orders
  for select to authenticated using (
    buyer_id = (select auth.uid()) or seller_id = (select auth.uid())
    or app_private.is_college_admin(college_id)
  );
create policy "Order participants view order items" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id
      and (o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid())
        or app_private.is_college_admin(o.college_id)))
  );
create policy "Order participants view payments" on public.payments
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id
      and (o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid())
        or app_private.is_college_admin(o.college_id)))
  );
create policy "Order participants view transactions" on public.transactions
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id
      and (o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid())
        or app_private.is_college_admin(o.college_id)))
  );

create policy "Approved participants read conversations" on public.conversations
  for select to authenticated using (
    (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()))
    and app_private.is_approved_member(college_id)
    or app_private.is_college_admin(college_id)
  );
create policy "Approved participants start conversations" on public.conversations
  for insert to authenticated with check (
    (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()))
    and app_private.is_approved_member(college_id)
    and exists (select 1 from public.profiles p
      where p.id = case when public.conversations.buyer_id = (select auth.uid())
        then public.conversations.seller_id else public.conversations.buyer_id end
      and p.college_id = public.conversations.college_id
      and p.verification_status = 'approved' and p.suspended_at is null)
  );
create policy "Participants read messages" on public.messages
  for select to authenticated using (
    exists (select 1 from public.conversations c where c.id = conversation_id
      and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
      and app_private.is_approved_member(c.college_id))
  );
create policy "Participants send messages" on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and exists (select 1 from public.conversations c where c.id = conversation_id
      and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
      and app_private.is_approved_member(c.college_id))
  );
create policy "Recipients mark messages read" on public.messages
  for update to authenticated using (
    sender_id <> (select auth.uid()) and exists (select 1 from public.conversations c
      where c.id = conversation_id and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid())))
  ) with check (read_at is not null);

create policy "Users read their notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users mark their notifications read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Approved members read reviews" on public.reviews
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = reviewed_user_id
      and app_private.is_approved_member(p.college_id))
  );
create policy "Order participants write their review" on public.reviews
  for insert to authenticated with check (reviewer_id = (select auth.uid()));

create policy "Reporters and admins view reports" on public.reports
  for select to authenticated using (
    reporter_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p where p.id = reporter_id
        and app_private.is_college_admin(p.college_id)
    )
  );
create policy "Approved members submit reports" on public.reports
  for insert to authenticated with check (
    reporter_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = reporter_id
      and p.verification_status = 'approved' and p.suspended_at is null)
  );
create policy "Admins manage reports" on public.reports
  for update to authenticated using (
    exists (select 1 from public.profiles p where p.id = reporter_id
      and app_private.is_college_admin(p.college_id))
  ) with check (
    exists (select 1 from public.profiles p where p.id = reporter_id
      and app_private.is_college_admin(p.college_id))
  );

create policy "Approved members read pickup points" on public.pickup_locations
  for select to authenticated using (
    (is_active and app_private.is_approved_member(college_id))
    or app_private.is_college_admin(college_id)
  );
create policy "Admins manage pickup points" on public.pickup_locations
  for all to authenticated using (app_private.is_college_admin(college_id))
  with check (app_private.is_college_admin(college_id));

create policy "Admins read platform settings" on public.platform_settings
  for select to authenticated using (app_private.is_college_admin(null));
create policy "Super admins manage platform settings" on public.platform_settings
  for all to authenticated using (app_private.is_super_admin()) with check (app_private.is_super_admin());
create policy "Admins read audit logs" on public.audit_logs
  for select to authenticated using (app_private.is_college_admin(null));

-- Storage uses the same private membership checks as the relational rows.
create policy "Users upload private verification documents" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'verification-documents'
    and app_private.can_upload_verification_document(name)
  );
create policy "Owners and college admins read verification documents" on storage.objects
  for select to authenticated using (
    bucket_id = 'verification-documents'
    and (
      split_part(name, '/', 1) = (select auth.uid())::text
      or app_private.can_review_verification_document(name)
    )
  );
create policy "Owners remove unsubmitted verification documents" on storage.objects
  for delete to authenticated using (
    bucket_id = 'verification-documents'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and not exists (
      select 1 from public.user_verifications v where v.id_document_path = storage.objects.name
    )
  );
create policy "Owners upload images for their own products" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'product-images' and app_private.can_upload_product_image(name)
  );
create policy "Product owners and approved members read images" on storage.objects
  for select to authenticated using (
    bucket_id = 'product-images'
    and (app_private.can_upload_product_image(name) or app_private.can_read_product_image(name))
  );
create policy "Owners remove images from their own drafts" on storage.objects
  for delete to authenticated using (
    bucket_id = 'product-images' and app_private.can_upload_product_image(name)
  );

-- Explicit grants: no client receives write access to payments, transactions, orders,
-- order items, notifications, or audit logs. RPCs and trusted server workflows own those writes.
revoke all on public.colleges, public.profiles, public.user_verifications, public.categories,
  public.products, public.product_images, public.wishlists, public.cart_items,
  public.orders, public.order_items, public.payments, public.transactions,
  public.conversations, public.messages, public.notifications, public.reviews,
  public.reports, public.pickup_locations, public.platform_settings, public.audit_logs
  from anon, authenticated;

grant select on public.colleges to anon, authenticated;
grant select on public.categories to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, handle, phone, bio, avatar_path) on public.profiles to authenticated;
grant select on public.user_verifications to authenticated;
grant insert (user_id, college_id, requested_role, college_email, id_document_path)
  on public.user_verifications to authenticated;
grant select, delete on public.products to authenticated;
grant insert (college_id, seller_id, category_id, name, description, price, item_condition, quantity)
  on public.products to authenticated;
grant update (category_id, name, description, price, item_condition, quantity)
  on public.products to authenticated;
grant select, insert, delete on public.product_images to authenticated;
grant select, insert, delete on public.wishlists to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
grant select on public.orders, public.order_items, public.payments, public.transactions to authenticated;
grant select on public.conversations to authenticated;
grant insert (college_id, buyer_id, seller_id, product_id, order_id)
  on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert on public.reviews to authenticated;
grant select on public.reports to authenticated;
grant insert (reporter_id, product_id, reported_user_id, reason, details)
  on public.reports to authenticated;
grant update (status, moderator_id, moderator_notes) on public.reports to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.pickup_locations to authenticated;
grant select, insert, update, delete on public.platform_settings to authenticated;
grant select on public.audit_logs to authenticated;

revoke all on function public.review_verification(uuid, public.verification_status, text) from public, anon;
revoke all on function public.submit_product(uuid) from public, anon;
revoke all on function public.withdraw_product(uuid) from public, anon;
revoke all on function public.moderate_product(uuid, public.product_status, text) from public, anon;
revoke all on function public.transition_order_status(uuid, public.order_status) from public, anon;
grant execute on function public.review_verification(uuid, public.verification_status, text) to authenticated;
grant execute on function public.submit_product(uuid) to authenticated;
grant execute on function public.withdraw_product(uuid) to authenticated;
grant execute on function public.moderate_product(uuid, public.product_status, text) to authenticated;
grant execute on function public.transition_order_status(uuid, public.order_status) to authenticated;
grant execute on function public.transition_order_status(uuid, public.order_status) to service_role;
revoke all on function public.create_checkout_orders(uuid, uuid) from public, anon;
revoke all on function public.create_single_checkout_order(uuid, uuid, uuid) from public, anon;
revoke all on function public.submit_manual_payment_reference(uuid, text) from public, anon;
revoke all on function public.reject_manual_payment_reference(uuid, text) from public, anon;
revoke all on function public.set_member_suspension(uuid, boolean, text) from public, anon;
revoke all on function public.seller_dashboard_metrics() from public, anon;
revoke all on function public.review_report(uuid, public.report_status, text) from public, anon;
revoke all on function public.update_commission_percent(numeric) from public, anon;
grant execute on function public.create_checkout_orders(uuid, uuid) to authenticated;
grant execute on function public.create_single_checkout_order(uuid, uuid, uuid) to authenticated;
grant execute on function public.submit_manual_payment_reference(uuid, text) to authenticated;
grant execute on function public.reject_manual_payment_reference(uuid, text) to authenticated;
grant execute on function public.set_member_suspension(uuid, boolean, text) to authenticated;
grant execute on function public.seller_dashboard_metrics() to authenticated;
grant execute on function public.review_report(uuid, public.report_status, text) to authenticated;
grant execute on function public.update_commission_percent(numeric) to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function app_private.validate_verification_submission() from public, anon, authenticated;
revoke all on function app_private.can_upload_verification_document(text) from public, anon, authenticated;
revoke all on function app_private.mark_profile_pending() from public, anon, authenticated;
revoke all on function app_private.validate_review() from public, anon, authenticated;
revoke all on function app_private.validate_message_sender() from public, anon, authenticated;
revoke all on function app_private.touch_conversation_after_message() from public, anon, authenticated;
revoke all on function app_private.validate_conversation() from public, anon, authenticated;
revoke all on function app_private.validate_report_target() from public, anon, authenticated;
revoke all on function app_private.touch_updated_at() from public, anon, authenticated;
revoke all on function app_private.guard_order_status_change() from public, anon, authenticated;
revoke all on function app_private.release_order_inventory() from public, anon, authenticated;
revoke all on function app_private.notify_new_order() from public, anon, authenticated;
revoke all on function app_private.guard_profile_privileged_fields() from public, anon, authenticated;
