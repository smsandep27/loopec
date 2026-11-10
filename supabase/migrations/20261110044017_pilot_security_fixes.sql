begin;

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

create function app_private.require_active_review_member()
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
create function app_private.require_active_order_seller()
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
create trigger require_active_order_seller
  before insert on public.orders
  for each row execute function app_private.require_active_order_seller();

-- The Next.js Server Actions consume the existing per-user quota before using
-- the server-only secret key for Storage writes. Direct authenticated uploads
-- are disabled so clients cannot bypass byte-signature validation.
create function public.authorize_private_upload(p_bucket_id text, p_name text)
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

commit;
