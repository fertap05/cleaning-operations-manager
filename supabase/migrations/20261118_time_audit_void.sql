-- 2026-11-18: Audit time entry edits and support safe voids.
-- Apply to STAGING first. Requires 20261118_finance_time.sql.
-- This migration never deletes existing entries.
begin;

alter table public.time_entries
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists correction_reason text,
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id);

-- Existing entries are retained, including mistakes to be voided from the UI.
alter table public.time_entries
  drop constraint if exists time_entries_void_reason_required;
alter table public.time_entries
  add constraint time_entries_void_reason_required
    check (
      (voided_at is null and void_reason is null and voided_by is null)
      or
      (voided_at is not null and nullif(btrim(void_reason),'') is not null and voided_by is not null)
    );

create table if not exists private.time_entry_audit (
  id bigint generated always as identity primary key,
  time_entry_id uuid not null,
  actor_id uuid not null,
  action text not null check (action in ('INSERT','UPDATE','VOID')),
  before_data jsonb,
  after_data jsonb,
  recorded_at timestamptz not null default now()
);
revoke all on private.time_entry_audit from public, anon, authenticated;

create or replace function private.audit_time_entry_change()
returns trigger language plpgsql security definer
set search_path=''
as $
declare
  actor uuid := auth.uid();
  action_name text;
  normal_clock_out boolean := false;
begin
  if actor is null or not private.is_admin() then
    raise exception 'Only an authorized administrator may change time entries';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Time entries cannot be deleted; void with a reason instead';
  end if;

  if tg_op = 'INSERT' then
    if new.voided_at is not null then
      raise exception 'A new time entry cannot start voided';
    end if;
    if new.ended_at is not null and
      new.ended_at - new.started_at < interval '1 minute' then
      raise exception 'Entry must be at least one minute long';
    end if;
    new.created_by := actor;
    new.updated_by := actor;
    new.created_at := now();
    new.updated_at := now();
    action_name := 'INSERT';
    insert into private.time_entry_audit(time_entry_id, actor_id, action, after_data)
    values (new.id, actor, action_name, to_jsonb(new));
    return new;
  end if;

  -- Once voided, a record is immutable.
  if old.voided_at is not null then
    raise exception 'Voided entries cannot be modified';
  end if;
  if new.id is distinct from old.id or
    new.created_at is distinct from old.created_at or
    new.created_by is distinct from old.created_by or
    new.source is distinct from old.source then
    raise exception 'Entry identity and original source cannot be changed';
  end if;
  if new.voided_at is not null then
    if nullif(btrim(new.void_reason),'') is null then
      raise exception 'Reason required to void an entry';
    end if;
    new.voided_by := actor;
    action_name := 'VOID';
  else
    if new.void_reason is not null or new.voided_by is not null then
      raise exception 'Invalid void state';
    end if;
    -- A normal clock-out modifies only ended_at. Do not require a correction reason.
    normal_clock_out := old.ended_at is null and new.ended_at is not null
       and new.employee_id is not distinct from old.employee_id
       and new.job_id is not distinct from old.job_id
       and new.started_at is not distinct from old.started_at
       and new.break_minutes is not distinct from old.break_minutes
       and new.notes is not distinct from old.notes
       and new.correction_reason is not distinct from old.correction_reason;
    if not normal_clock_out and (
      nullif(btrim(new.correction_reason),'') is null
      or new.correction_reason is not distinct from old.correction_reason
    ) then
      raise exception 'Supply a new reason when correcting a time entry';
    end if;
    if new.ended_at is not null and
      new.ended_at - new.started_at < interval '1 minute' then
      raise exception 'Entry must be at least one minute long';
    end if;
    action_name := 'UPDATE';
  end if;
  new.updated_at := now();
  new.updated_by := actor;
  insert into private.time_entry_audit(time_entry_id,actor_id,action,before_data,after_data)
  values (new.id, actor, action_name, to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists trg_time_entry_audit on public.time_entries;
create trigger trg_time_entry_audit
before insert or update or delete on public.time_entries
for each row execute function private.audit_time_entry_change();

-- Authenticated members may write but never physically DELETE time records.
revoke delete on public.time_entries from authenticated, anon, public;
grant select, insert, update on public.time_entries to authenticated;

commit;

-- Only DBA/service operators have access to private audit records.
-- Do not expose the private schema or an audit-read RPC to the browser.
-- The admin UI will show "Anulado", but historical rows remain for investigation.
