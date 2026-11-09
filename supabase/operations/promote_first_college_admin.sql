-- Run once from the Supabase SQL Editor as the project owner.
-- Replace the email below with an already registered, email-confirmed NITC account.
-- This promotes that account to the first NITC college admin and writes an audit entry.

begin;

do $$
declare
  admin_email text := lower(trim('replace-with-confirmed-admin@nitc.ac.in'));
  target_college_id uuid;
  college_domains text[];
  admin_user_id uuid;
  admin_profile public.profiles%rowtype;
begin
  if not exists (
    select 1 from pg_catalog.pg_roles r
    where r.rolname = current_user and (r.rolsuper or r.rolbypassrls)
  ) then
    raise exception 'Run this script from the Supabase SQL Editor as the project owner';
  end if;

  if admin_email = 'replace-with-confirmed-admin@nitc.ac.in'
     or admin_email !~* '^[^@]+@nitc[.]ac[.]in$' then
    raise exception 'Replace admin_email with the confirmed NITC college-admin email';
  end if;

  select c.id, c.email_domains
  into target_college_id, college_domains
  from public.colleges c
  where c.slug = 'nit-calicut' and c.is_active;
  if not found or not ('nitc.ac.in' = any(coalesce(college_domains, array[]::text[]))) then
    raise exception 'The active NIT Calicut college seed is missing or has no nitc.ac.in domain';
  end if;

  select u.id into admin_user_id
  from auth.users u
  where lower(u.email) = admin_email and u.email_confirmed_at is not null;
  if not found then
    raise exception 'Register this account and confirm its college email before running the script';
  end if;

  select p.* into admin_profile
  from public.profiles p
  where p.id = admin_user_id
  for update;
  if not found then
    raise exception 'The account profile has not been created yet';
  end if;
  if admin_profile.suspended_at is not null or admin_profile.verification_status = 'suspended' then
    raise exception 'A suspended profile cannot be promoted';
  end if;
  if admin_profile.college_id is not null and admin_profile.college_id <> target_college_id then
    raise exception 'This account already belongs to another college';
  end if;
  if admin_profile.role = 'super_admin' then
    raise exception 'This account is already a super admin; no changes were made';
  end if;
  if admin_profile.role = 'college_admin'
     and admin_profile.college_id = target_college_id
     and admin_profile.verification_status = 'approved' then
    raise notice 'This account is already the approved NIT Calicut college admin';
    return;
  end if;

  perform pg_catalog.set_config('app.profile_privileged_update', 'allowed', true);
  update public.profiles
  set college_id = target_college_id,
      role = 'college_admin'::public.community_role,
      verification_status = 'approved'::public.verification_status,
      updated_at = now()
  where id = admin_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    null,
    'initial_college_admin_bootstrap',
    'profile',
    admin_user_id,
    jsonb_build_object(
      'role', admin_profile.role,
      'college_id', admin_profile.college_id,
      'verification_status', admin_profile.verification_status
    ),
    jsonb_build_object(
      'role', 'college_admin',
      'college_id', target_college_id,
      'verification_status', 'approved',
      'bootstrap_operator', current_user
    )
  );

  raise notice 'NIT Calicut college-admin access created and audit logged for %', admin_email;
end;
$$;

commit;
