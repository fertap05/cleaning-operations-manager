-- READ-ONLY SECURITY INVENTORY. Run in Supabase SQL Editor to inspect.
-- Do not paste results with email addresses or user IDs into public issues.
-- Every public table containing business/private records must have RLS.
select n.nspname as schema_name,c.relname as table_name,
       c.relrowsecurity as rls_enabled,c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;

-- All policies: any unexpected permissive read/write policy needs investigation.
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies
where schemaname='public'
order by tablename,policyname;

-- Privileges that anon may hold through a direct GRANT or via PUBLIC.
select table_name,grantee,privilege_type
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','PUBLIC')
order by table_name,grantee,privilege_type;

-- Auth allowlist (must show EXACTLY two owners and one developer).
select role,count(*) as accounts
from public.admin_users
group by role
order by role;

-- Enable MFA on all three accounts before executing the separate MFA policy.
-- API access must be tested WITHOUT a JWT, WITH a non-member JWT,
-- WITH a member aal1 JWT, and WITH a member aal2 JWT.
