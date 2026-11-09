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
