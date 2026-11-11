-- ==============================================================================
-- LOOPEC PILOT: PENDING MIGRATIONS BATCH (Migrations 2 through 5)
-- Apply in the Supabase SQL Editor as the project owner.
-- This applies:
--   1. 20261109000000_admin_pickup_locations.sql
--   2. 20261109000001_realtime_messages.sql
--   3. 20261109000002_action_rate_limits.sql
--   4. 20261110044017_pilot_security_fixes.sql
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. ADMIN PICKUP LOCATIONS (20261109000000)
-- ------------------------------------------------------------------------------
create or replace function public.manage_pickup_location(
  p_location_id uuid,
  p_college_id uuid,
  p_name text,
  p_address text,
  p_instructions text,
  p_sort_order smallint,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.community_role;
  v_college_id uuid;
  v_suspended_at timestamptz;
  v_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_old public.pickup_locations%rowtype;
begin
  select p.role, p.college_id, p.suspended_at
  into v_role, v_college_id, v_suspended_at
  from public.profiles p
  where p.id = v_actor;

  if v_actor is null or v_role is null or v_role not in ('college_admin', 'super_admin') or v_suspended_at is not null then
    raise exception 'not authorized to manage pickup locations' using errcode = '42501';
  end if;
  if v_role <> 'super_admin' and v_college_id is distinct from p_college_id then
    raise exception 'cannot manage pickup locations for another college' using errcode = '42501';
  end if;

  if p_location_id is null then
    insert into public.pickup_locations (college_id, name, address, instructions, sort_order, is_active)
    values (p_college_id, trim(p_name), trim(p_address), coalesce(trim(p_instructions), ''), p_sort_order, p_is_active)
    returning id into v_id;
    select to_jsonb(l) into v_after from public.pickup_locations l where l.id = v_id;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_data)
    values (v_actor, 'pickup_location_created', 'pickup_location', v_id, v_after);
  else
    select l.* into v_old
    from public.pickup_locations l
    where l.id = p_location_id and l.college_id = p_college_id
    for update;
    if not found then
      raise exception 'pickup location not found' using errcode = 'P0002';
    end if;
    v_before := to_jsonb(v_old);
    update public.pickup_locations
    set name = trim(p_name),
        address = trim(p_address),
        instructions = coalesce(trim(p_instructions), ''),
        sort_order = p_sort_order,
        is_active = p_is_active
    where id = p_location_id and college_id = p_college_id
    returning id into v_id;
    select to_jsonb(l) into v_after from public.pickup_locations l where l.id = v_id;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
    values (v_actor, 'pickup_location_updated', 'pickup_location', v_id, v_before, v_after);
  end if;
  return v_id;
end;
$$;

revoke all on function public.manage_pickup_location(uuid, uuid, text, text, text, smallint, boolean) from public, anon;
grant execute on function public.manage_pickup_location(uuid, uuid, text, text, text, smallint, boolean) to authenticated;

-- ------------------------------------------------------------------------------
-- 2. REALTIME MESSAGES (20261109000001)
-- ------------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. ACTION RATE LIMITS (20261109000002)
-- ------------------------------------------------------------------------------
create table if not exists app_private.user_action_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in (
    'message', 'listing', 'verification', 'report', 'checkout',
    'payment_reference', 'verification_upload', 'listing_image_upload'
  )),
  window_started_at timestamptz not null,
  hit_count integer not null check (hit_count > 0),
  primary key (user_id, action)
);
revoke all on app_private.user_action_rate_limits from public, anon, authenticated, service_role;
alter table app_private.user_action_rate_limits enable row level security;

create or replace function app_private.consume_user_action_rate_limit(
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_hits integer;
begin
  if actor_id is null or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role' then
    return;
  end if;
  if p_action not in (
       'message', 'listing', 'verification', 'report', 'checkout',
       'payment_reference', 'verification_upload', 'listing_image_upload'
     )
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception using errcode = '22023', message = 'Invalid action rate limit configuration';
  end if;

  insert into app_private.user_action_rate_limits (user_id, action, window_started_at, hit_count)
  values (actor_id, p_action, now(), 1)
  on conflict (user_id, action) do update
  set window_started_at = case
        when app_private.user_action_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then now()
        else app_private.user_action_rate_limits.window_started_at
      end,
      hit_count = case
        when app_private.user_action_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then 1
        else app_private.user_action_rate_limits.hit_count + 1
      end
  returning hit_count into current_hits;

  if current_hits > p_limit then
    raise exception using errcode = 'P0001', message = 'rate_limit_exceeded';
  end if;
end;
$$;

create or replace function app_private.limit_user_action_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.consume_user_action_rate_limit(tg_argv[0], tg_argv[1]::integer, tg_argv[2]::integer);
  return new;
end;
$$;

create or replace function app_private.consume_private_upload_limit(p_bucket_id text, p_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_bucket_id = 'verification-documents' then
    if not app_private.can_upload_verification_document(p_name) then return false; end if;
    perform app_private.consume_user_action_rate_limit('verification_upload', 5, 86400);
    return true;
  elsif p_bucket_id = 'product-images' then
    if not app_private.can_upload_product_image(p_name) then return false; end if;
    perform app_private.consume_user_action_rate_limit('listing_image_upload', 30, 3600);
    return true;
  end if;
  return false;
end;
$$;

grant execute on function app_private.consume_private_upload_limit(text, text) to authenticated;

create or replace function app_private.limit_payment_reference_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider_payment_id is not null
     and new.provider_payment_id is distinct from old.provider_payment_id then
    perform app_private.consume_user_action_rate_limit('payment_reference', 5, 3600);
  end if;
  return new;
end;
$$;

drop trigger if exists user_action_rate_limit_messages on public.messages;
create trigger user_action_rate_limit_messages
  before insert on public.messages
  for each row execute function app_private.limit_user_action_insert('message', '30', '60');

drop trigger if exists user_action_rate_limit_products on public.products;
create trigger user_action_rate_limit_products
  before insert on public.products
  for each row execute function app_private.limit_user_action_insert('listing', '10', '86400');

drop trigger if exists user_action_rate_limit_verifications on public.user_verifications;
create trigger user_action_rate_limit_verifications
  before insert on public.user_verifications
  for each row execute function app_private.limit_user_action_insert('verification', '5', '86400');

drop trigger if exists user_action_rate_limit_reports on public.reports;
create trigger user_action_rate_limit_reports
  before insert on public.reports
  for each row execute function app_private.limit_user_action_insert('report', '10', '3600');

drop trigger if exists user_action_rate_limit_orders on public.orders;
create trigger user_action_rate_limit_orders
  before insert on public.orders
  for each row execute function app_private.limit_user_action_insert('checkout', '10', '300');

drop trigger if exists user_action_rate_limit_payment_references on public.payments;
create trigger user_action_rate_limit_payment_references
  before update of provider_payment_id on public.payments
  for each row execute function app_private.limit_payment_reference_update();

revoke all on function app_private.consume_user_action_rate_limit(text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function app_private.limit_user_action_insert() from public, anon, authenticated, service_role;
revoke all on function app_private.consume_private_upload_limit(text, text) from public, anon, service_role;
revoke all on function app_private.limit_payment_reference_update() from public, anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. PILOT SECURITY FIXES (20261110044017)
-- ------------------------------------------------------------------------------

-- Peer reads must be limited to members who passed review and still have access.
drop policy if exists "Profiles visible to owner community and admins" on public.profiles;
create policy "Profiles visible to owner community and admins" on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or (
      verification_status = 'approved'
      and suspended_at is null
      and app_private.is_approved_member(college_id)
    )
    or app_private.is_college_admin(college_id)
  );

-- Keep profile edits available to pending members but stop them after suspension.
drop policy if exists "Owners update their profile" on public.profiles;
create policy "Owners update their profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and suspended_at is null)
  with check (id = (select auth.uid()) and suspended_at is null);

-- Keep direct Data API review inserts aligned with the Server Action's member check.
drop policy if exists "Order participants write their review" on public.reviews;
create policy "Order participants write their review" on public.reviews
  for insert to authenticated with check (
    reviewer_id = (select auth.uid())
    and exists (
      select 1 from public.orders o
      where o.id = public.reviews.order_id
        and o.status = 'completed'
        and (
          (o.buyer_id = (select auth.uid()) and o.seller_id = public.reviews.reviewed_user_id)
          or (o.seller_id = (select auth.uid()) and o.buyer_id = public.reviews.reviewed_user_id)
        )
    )
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.verification_status = 'approved'
        and p.suspended_at is null
    )
  );

create or replace function app_private.require_active_review_member()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.reviewer_id
      and p.verification_status = 'approved'
      and p.suspended_at is null
  ) then
    raise exception 'Only active approved members can submit a review';
  end if;
  return new;
end;
$$;
revoke all on function app_private.require_active_review_member() from public, anon, authenticated, service_role;

drop trigger if exists require_active_review_member on public.reviews;
create trigger require_active_review_member
  before insert on public.reviews
  for each row execute function app_private.require_active_review_member();

-- Hide suspended sellers' listings, and reject carts that reference one.
drop policy if exists "Approved members read marketplace listings" on public.products;
create policy "Approved members read marketplace listings" on public.products
  for select to authenticated using (
    (
      status = 'approved'
      and app_private.is_approved_member(college_id)
      and exists (
        select 1 from public.profiles seller
        where seller.id = products.seller_id
          and seller.verification_status = 'approved'
          and seller.suspended_at is null
      )
    )
    or seller_id = (select auth.uid())
    or app_private.is_college_admin(college_id)
  );

drop policy if exists "Owners manage their cart" on public.cart_items;
create policy "Owners manage their cart" on public.cart_items
  for all to authenticated using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.products p
      join public.profiles seller on seller.id = p.seller_id
      where p.id = product_id
        and p.status = 'approved'
        and p.quantity >= public.cart_items.quantity
        and p.seller_id <> (select auth.uid())
        and app_private.is_approved_member(p.college_id)
        and seller.verification_status = 'approved'
        and seller.suspended_at is null
    )
  );

-- Recheck seller state at the database write boundary for both checkout RPCs.
create or replace function app_private.require_active_order_seller()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.seller_id
      and p.verification_status = 'approved'
      and p.suspended_at is null
  ) then
    raise exception 'This seller is not available for new orders';
  end if;
  return new;
end;
$$;
revoke all on function app_private.require_active_order_seller() from public, anon, authenticated, service_role;

drop trigger if exists require_active_order_seller on public.orders;
create trigger require_active_order_seller
  before insert on public.orders
  for each row execute function app_private.require_active_order_seller();

-- The Next.js Server Actions consume the existing per-user quota before using
-- the server-only secret key for Storage writes. Direct authenticated uploads
-- are disabled so clients cannot bypass byte-signature validation.
create or replace function public.authorize_private_upload(p_bucket_id text, p_name text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return false; end if;
  return app_private.consume_private_upload_limit(p_bucket_id, p_name);
end;
$$;
revoke all on function public.authorize_private_upload(text, text) from public, anon, service_role;
grant execute on function public.authorize_private_upload(text, text) to authenticated;

drop policy if exists "Users upload private verification documents" on storage.objects;
drop policy if exists "Owners upload images for their own products" on storage.objects;

update storage.buckets
set file_size_limit = 4194304
where id = 'product-images';

-- ------------------------------------------------------------------------------
-- 5. ONLINE PAYMENTS & 5% COMMISSION CONFIRMATION (20261111000000)
-- ------------------------------------------------------------------------------
create or replace function public.confirm_online_payment(
  p_order_id uuid,
  p_provider text,
  p_provider_payment_id text,
  p_provider_order_id text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.orders%rowtype;
  payment_item public.payments%rowtype;
  actor_id uuid := (select auth.uid());
  trusted_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  clean_payment_id text := trim(coalesce(p_provider_payment_id, ''));
  clean_order_id text := nullif(trim(coalesce(p_provider_order_id, '')), '');
  clean_provider text := lower(trim(coalesce(p_provider, 'razorpay')));
begin
  if clean_payment_id = '' then
    raise exception 'A valid provider payment ID is required';
  end if;

  select * into item from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if not trusted_service and actor_id is distinct from item.buyer_id and not app_private.is_college_admin(item.college_id) then
    raise exception 'Unauthorized to confirm payment for this order';
  end if;

  if item.status not in ('pending', 'accepted', 'payment_pending') then
    if item.status = 'paid' then
      return item;
    end if;
    raise exception 'Order is not in a payable state (status: %)', item.status;
  end if;

  select * into payment_item from public.payments
  where order_id = item.id
  order by created_at desc limit 1 for update;

  if not found then
    insert into public.payments (
      order_id, provider, method, status, amount, currency,
      idempotency_key, provider_payment_id, provider_order_id, verified_at
    ) values (
      item.id, clean_provider, 'online', 'paid', item.total_amount, item.currency,
      'pay:' || clean_provider || ':' || clean_payment_id, clean_payment_id, clean_order_id, now()
    ) returning * into payment_item;
  else
    update public.payments
    set provider = clean_provider,
        method = 'online',
        status = 'paid',
        provider_payment_id = clean_payment_id,
        provider_order_id = coalesce(clean_order_id, provider_order_id),
        verified_at = now(),
        updated_at = now()
    where id = payment_item.id returning * into payment_item;
  end if;

  perform set_config('app.order_transition', 'allowed', true);
  update public.orders
  set status = 'paid', updated_at = now()
  where id = item.id returning * into item;
  perform set_config('app.order_transition', '', true);

  insert into public.transactions (
    order_id, payment_id, transaction_type, gross_amount,
    commission_amount, seller_net_amount, currency, idempotency_key
  ) values (
    item.id, payment_item.id, 'payment', payment_item.amount,
    item.commission_amount, greatest(payment_item.amount - item.commission_amount, 0),
    payment_item.currency, 'payment:' || payment_item.id::text
  ) on conflict (idempotency_key) do nothing;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    actor_id, 'online_payment_confirmed', 'order', item.id,
    jsonb_build_object('status', 'accepted', 'provider', clean_provider),
    jsonb_build_object('status', 'paid', 'payment_id', payment_item.id, 'provider_payment_id', clean_payment_id)
  );

  insert into public.notifications (user_id, kind, title, body, payload)
  values (
    item.seller_id, 'order_status', 'Payment received',
    'Payment for order ' || left(item.id::text, 8) || ' has been confirmed. Please prepare the item for campus pickup.',
    jsonb_build_object('order_id', item.id, 'status', 'paid')
  );

  insert into public.notifications (user_id, kind, title, body, payload)
  values (
    item.buyer_id, 'order_status', 'Payment successful',
    'Your payment for order ' || left(item.id::text, 8) || ' was confirmed. The seller is preparing the campus pickup.',
    jsonb_build_object('order_id', item.id, 'status', 'paid')
  );

  return item;
end;
$$;

revoke all on function public.confirm_online_payment(uuid, text, text, text) from public, anon;
grant execute on function public.confirm_online_payment(uuid, text, text, text) to authenticated;

commit;
