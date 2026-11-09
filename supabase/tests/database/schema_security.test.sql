begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(39);

select extensions.has_table('public', 'colleges', 'college directory exists');
select extensions.has_table('public', 'profiles', 'member profiles exist');
select extensions.has_table('public', 'user_verifications', 'verification records exist');
select extensions.has_table('public', 'categories', 'listing categories exist');
select extensions.has_table('public', 'products', 'marketplace listings exist');
select extensions.has_table('public', 'product_images', 'listing image metadata exists');
select extensions.has_table('public', 'wishlists', 'wishlists exist');
select extensions.has_table('public', 'cart_items', 'shopping carts exist');
select extensions.has_table('public', 'pickup_locations', 'campus pickup locations exist');
select extensions.has_table('public', 'orders', 'orders exist');
select extensions.has_table('public', 'order_items', 'order snapshots exist');
select extensions.has_table('public', 'payments', 'payment review records exist');
select extensions.has_table('public', 'transactions', 'financial ledger exists');
select extensions.has_table('public', 'conversations', 'conversations exist');
select extensions.has_table('public', 'messages', 'messages exist');
select extensions.has_table('public', 'notifications', 'notifications exist');
select extensions.has_table('public', 'reviews', 'reviews exist');
select extensions.has_table('public', 'reports', 'reports exist');
select extensions.has_table('public', 'platform_settings', 'platform settings exist');
select extensions.has_table('public', 'audit_logs', 'audit log exists');

select extensions.is(
  (select count(*)::integer
   from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relrowsecurity
     and c.relname = any (array[
       'colleges', 'profiles', 'user_verifications', 'categories', 'products',
       'product_images', 'wishlists', 'cart_items', 'pickup_locations', 'orders',
       'order_items', 'payments', 'transactions', 'conversations', 'messages',
       'notifications', 'reviews', 'reports', 'platform_settings', 'audit_logs'
     ])),
  20,
  'row-level security is enabled on every application table'
);
select extensions.ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anonymous users cannot read member profiles');
select extensions.ok(not has_table_privilege('anon', 'public.products', 'select'), 'anonymous users cannot read private marketplace tables');
select extensions.ok(has_table_privilege('anon', 'public.colleges', 'select'), 'anonymous users can load the college signup directory');
select extensions.ok(not has_table_privilege('authenticated', 'public.orders', 'insert'), 'orders can only be created by checkout workflows');
select extensions.ok(not has_table_privilege('authenticated', 'public.payments', 'insert'), 'clients cannot create payment records');
select extensions.ok(not has_table_privilege('authenticated', 'public.payments', 'update'), 'clients cannot verify payments directly');
select extensions.ok(not has_table_privilege('authenticated', 'public.transactions', 'insert'), 'clients cannot write the financial ledger');
select extensions.ok(not has_column_privilege('authenticated', 'public.profiles', 'role', 'update'), 'members cannot change their own role');
select extensions.ok(not has_column_privilege('authenticated', 'public.profiles', 'verification_status', 'update'), 'members cannot approve their own profile');
select extensions.ok(not has_function_privilege('anon', 'public.transition_order_status(uuid,public.order_status)', 'execute'), 'anonymous users cannot change order status');
select extensions.ok(has_function_privilege('authenticated', 'public.create_single_checkout_order(uuid,uuid,uuid)', 'execute'), 'approved members can use the guarded checkout function');
select extensions.ok(has_function_privilege('authenticated', 'public.review_verification(uuid,public.verification_status,text)', 'execute'), 'authenticated callers can invoke the admin-guarded verification review');
select extensions.ok(has_function_privilege('authenticated', 'public.manage_pickup_location(uuid,uuid,text,text,text,smallint,boolean)', 'execute'), 'authenticated callers can invoke the admin-guarded pickup manager');
select extensions.ok(not has_function_privilege('anon', 'public.manage_pickup_location(uuid,uuid,text,text,text,smallint,boolean)', 'execute'), 'anonymous users cannot manage pickup locations');
select extensions.has_table('app_private', 'user_action_rate_limits', 'per-user rate limit storage exists outside the public schema');
select extensions.ok(not has_table_privilege('authenticated', 'app_private.user_action_rate_limits', 'select'), 'users cannot inspect rate-limit records');
select extensions.ok(not has_schema_privilege('anon', 'app_private', 'usage'), 'anonymous users cannot access private authorization helpers');
select extensions.ok(has_schema_privilege('authenticated', 'app_private', 'usage'), 'authenticated RLS checks can use private authorization helpers');

select * from extensions.finish();
rollback;
