-- 2026-11-18: Enforce two-factor MFA at PostgreSQL RLS layer.
-- DO NOT RUN until all three authorized owners/developer have ENROLLED
-- and VERIFIED a TOTP factor and tested sign-in in the application.
-- Apply to STAGING, test unverified JWTs cannot access business tables,
-- and only then apply to PRODUCTION.
begin;
do $$
declare t text;
begin
  foreach t in array array[
    'clients','properties','employees','jobs','job_assignments',
    'job_payments','time_entries'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists "require aal2 mfa" on public.%I',t);
    execute format(
      'create policy "require aal2 mfa" on public.%I as restrictive for all to authenticated using (((select auth.jwt())->>''aal'') = ''aal2'') with check (((select auth.jwt())->>''aal'') = ''aal2'')',
      t
    );
  end loop;
end $$;
commit;

-- Keep public.admin_users self-read available at aal1 for the MFA enrollment
-- bootstrap flow; membership still does NOT grant access to business tables.
-- Validate RLS with real aal1/aal2 JWTs before using customer data.
