-- Read-only pilot preflight. Run in the Supabase SQL Editor as the project owner.
-- This inspects the current schema and permissions; it does not record or apply migrations.

with expected_tables(table_name) as (
  values
    ('colleges'),
    ('profiles'),
    ('user_verifications'),
    ('categories'),
    ('products'),
    ('product_images'),
    ('wishlists'),
    ('cart_items'),
    ('pickup_locations'),
    ('orders'),
    ('order_items'),
    ('payments'),
    ('transactions'),
    ('conversations'),
    ('messages'),
    ('notifications'),
    ('reviews'),
    ('reports'),
    ('platform_settings'),
    ('audit_logs')
),
relations as (
  select
    table_name,
    to_regclass(format('public.%I', table_name)) as relation_oid
  from expected_tables
),
checks as (
  select
    'Table public.' || table_name as check_name,
    relation_oid is not null as passed,
    'exists' as expected
  from relations

  union all
  select
    'RLS enabled on all 20 pilot tables',
    not exists (
      select 1
      from relations r
      left join pg_class c on c.oid = r.relation_oid
      where c.oid is null or c.relrowsecurity is not true
    ),
    'all tables exist with row-level security enabled'

  union all
  select
    'anon has public schema usage',
    coalesce(has_schema_privilege('anon', 'public', 'USAGE'), false),
    'true'

  union all
  select
    'authenticated has public schema usage',
    coalesce(has_schema_privilege('authenticated', 'public', 'USAGE'), false),
    'true'

  union all
  select
    'anon can read active college lookup',
    coalesce(has_table_privilege('anon', to_regclass('public.colleges')::oid, 'SELECT'), false),
    'true'

  union all
  select
    'Active NITC college row has nitc.ac.in domain',
    exists (
      select 1 from public.colleges
      where slug = 'nit-calicut'
        and is_active
        and email_domains @> array['nitc.ac.in']::text[]
    ),
    'true'

  union all
  select
    'authenticated can read categories',
    coalesce(has_table_privilege('authenticated', to_regclass('public.categories')::oid, 'SELECT'), false),
    'true'

  union all
  select
    'authenticated can read products',
    coalesce(has_table_privilege('authenticated', to_regclass('public.products')::oid, 'SELECT'), false),
    'true'

  union all
  select
    'authenticated can read pickup locations',
    coalesce(has_table_privilege('authenticated', to_regclass('public.pickup_locations')::oid, 'SELECT'), false),
    'true'

  union all
  select
    'anon cannot read products',
    not coalesce(has_table_privilege('anon', to_regclass('public.products')::oid, 'SELECT'), false),
    'true; marketplace data must stay member-only'

  union all
  select
    'anon cannot read categories',
    not coalesce(has_table_privilege('anon', to_regclass('public.categories')::oid, 'SELECT'), false),
    'true; category data is served to signed-in members'

  union all
  select
    'Pickup-location admin RPC exists',
    to_regprocedure('public.manage_pickup_location(uuid,uuid,text,text,text,smallint,boolean)') is not null,
    'present after 20261109000000_admin_pickup_locations.sql'

  union all
  select
    'Messages are in Supabase Realtime publication',
    exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ),
    'present after 20261109000001_realtime_messages.sql'

  union all
  select
    'User action rate-limit table exists',
    to_regclass('app_private.user_action_rate_limits') is not null,
    'present after 20261109000002_action_rate_limits.sql'

  union all
  select
    'Private upload authorization RPC is executable by authenticated',
    coalesce(has_function_privilege(
      'authenticated',
      to_regprocedure('public.authorize_private_upload(text,text)')::oid,
      'EXECUTE'
    ), false),
    'present after 20261110044017_pilot_security_fixes.sql'

  union all
  select
    'Private upload authorization RPC is not executable by anon',
    not coalesce(has_function_privilege(
      'anon',
      to_regprocedure('public.authorize_private_upload(text,text)')::oid,
      'EXECUTE'
    ), false),
    'true'

  union all
  select
    'Product images bucket is private and limited to 4 MiB',
    coalesce((
      select not b.public and b.file_size_limit = 4194304
      from storage.buckets b
      where b.id = 'product-images'
    ), false),
    'public = false; file_size_limit = 4194304'

  union all
  select
    'Verification documents bucket is private',
    coalesce((
      select not b.public
      from storage.buckets b
      where b.id = 'verification-documents'
    ), false),
    'public = false'

  union all
  select
    'Direct authenticated upload policies are removed',
    not exists (
      select 1 from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and cmd in ('INSERT', 'ALL')
        and roles && array['public', 'anon', 'authenticated']::name[]
    ),
    'no public, anon, or authenticated role can upload directly; server actions use the secret key'
)
select
  check_name,
  case when passed then 'PASS' else 'CHECK' end as result,
  expected
from checks
order by check_name;
