-- User-scoped write limits for pilot actions and private file uploads.
-- Apply after the initial schema and the 20261109 migrations.

begin;

create table app_private.user_action_rate_limits (
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

create function app_private.consume_user_action_rate_limit(
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
  -- Trusted server-side operations have their own controls and are not user-limited.
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

create function app_private.limit_user_action_insert()
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

create function app_private.consume_private_upload_limit(p_bucket_id text, p_name text)
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

create function app_private.limit_payment_reference_update()
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

create trigger user_action_rate_limit_messages
  before insert on public.messages
  for each row execute function app_private.limit_user_action_insert('message', '30', '60');
create trigger user_action_rate_limit_products
  before insert on public.products
  for each row execute function app_private.limit_user_action_insert('listing', '10', '86400');
create trigger user_action_rate_limit_verifications
  before insert on public.user_verifications
  for each row execute function app_private.limit_user_action_insert('verification', '5', '86400');
create trigger user_action_rate_limit_reports
  before insert on public.reports
  for each row execute function app_private.limit_user_action_insert('report', '10', '3600');
create trigger user_action_rate_limit_orders
  before insert on public.orders
  for each row execute function app_private.limit_user_action_insert('checkout', '10', '300');
create trigger user_action_rate_limit_payment_references
  before update of provider_payment_id on public.payments
  for each row execute function app_private.limit_payment_reference_update();
-- Keep upload limits inside Storage's INSERT policies instead of adding custom
-- triggers to Supabase-managed storage.objects.
drop policy "Users upload private verification documents" on storage.objects;
create policy "Users upload private verification documents" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'verification-documents'
    and app_private.consume_private_upload_limit(bucket_id, name)
  );
drop policy "Owners upload images for their own products" on storage.objects;
create policy "Owners upload images for their own products" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'product-images'
    and app_private.consume_private_upload_limit(bucket_id, name)
  );

revoke all on function app_private.consume_user_action_rate_limit(text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function app_private.limit_user_action_insert() from public, anon, authenticated, service_role;
revoke all on function app_private.consume_private_upload_limit(text, text) from public, anon, service_role;
revoke all on function app_private.limit_payment_reference_update() from public, anon, authenticated, service_role;

commit;
