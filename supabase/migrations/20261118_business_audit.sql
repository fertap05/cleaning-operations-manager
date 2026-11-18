-- 2026-11-18: Operational audit for financial and scheduling changes
-- Apply only after staging and backup testing.
-- Requires private schema and tables from prior migrations.
begin;

create table if not exists private.business_audit (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  actor_id uuid,
  previous_data jsonb,
  current_data jsonb,
  recorded_at timestamptz not null default now()
);

-- This private audit trail is only readable by trusted database operators.
revoke all on private.business_audit from public, anon, authenticated;

create or replace function private.record_business_change()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  who uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into private.business_audit(
      table_name,record_id,operation,actor_id,current_data
    ) values (tg_table_name,new.id,'INSERT',who,to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    -- Ignore no-op updates but record modifications and payment reversals.
    if to_jsonb(new) is distinct from to_jsonb(old) then
      insert into private.business_audit(
        table_name,record_id,operation,actor_id,previous_data,current_data
      ) values (tg_table_name,new.id,'UPDATE',who,to_jsonb(old),to_jsonb(new));
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    insert into private.business_audit(
      table_name,record_id,operation,actor_id,previous_data
    ) values (tg_table_name,old.id,'DELETE',who,to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

do $$
declare tab text;
begin
  foreach tab in array array[
    'clients','properties','employees','jobs',
    'job_assignments','job_payments'
  ] loop
    execute format('drop trigger if exists trg_business_audit on public.%I',tab);
    execute format(
      'create trigger trg_business_audit after insert or update or delete on public.%I for each row execute function private.record_business_change()',
      tab
    );
  end loop;
end $$;

-- Owners should disable/close records rather than permanently delete
-- customers, homes, workers, jobs, or payment records.
revoke delete on public.clients, public.properties, public.employees,
  public.jobs, public.job_payments from authenticated, anon, public;

-- Keep DELETE on job_assignments because save_job() atomically replaces a crew.
-- It is still limited by member RLS and (after activation) mandatory MFA.
commit;

-- Audit records contain confidential business data.
-- Do not export them to GitHub, analytics tools or browser endpoints.
