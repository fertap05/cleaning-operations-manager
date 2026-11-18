-- Cleaning Operations Manager / Finance + hours
-- Apply AFTER 20261117_secure_admin_mvp.sql.
-- Safe to rerun: does not delete existing clients, jobs or payment rows.
begin;

create table if not exists public.job_payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  method text not null check (method in ('cash','check','venmo','other')),
  received_on date not null default current_date,
  reference text,
  notes text,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  check ((voided_at is null and void_reason is null) or
         (voided_at is not null and nullif(btrim(void_reason),'') is not null))
);
create index if not exists idx_job_payments_job on public.job_payments(job_id);
create index if not exists idx_job_payments_received_on on public.job_payments(received_on);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  break_minutes integer not null default 0 check (break_minutes between 0 and 1440),
  notes text,
  source text not null default 'admin_manual' check (source in ('admin_manual','admin_clock')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at),
  check (ended_at is null or break_minutes * interval '1 minute' < ended_at - started_at)
);
create index if not exists idx_time_entries_employee on public.time_entries(employee_id,started_at);
create index if not exists idx_time_entries_job on public.time_entries(job_id);

alter table public.job_payments enable row level security;
alter table public.time_entries enable row level security;

revoke all on table public.job_payments,public.time_entries from public, anon;
grant select, insert, update on table public.job_payments,public.time_entries to authenticated;

drop policy if exists "admin access" on public.job_payments;
drop policy if exists "admin access" on public.time_entries;
create policy "admin access" on public.job_payments for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin access" on public.time_entries for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Payment deletions are intentionally prohibited. Corrections are voids with a reason.
-- Updates to monetary/date fields are prohibited after insertion by an enforced trigger.
create or replace function private.protect_payment_records()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.job_id is distinct from old.job_id
    or new.amount is distinct from old.amount or new.method is distinct from old.method
    or new.received_on is distinct from old.received_on
    or new.reference is distinct from old.reference or new.notes is distinct from old.notes
    or new.created_at is distinct from old.created_at then
    raise exception 'Payment details are immutable; void and re-enter to correct';
  end if;
  if old.voided_at is not null then
    raise exception 'Voided payments cannot be edited';
  end if;
  if new.voided_at is null or nullif(btrim(new.void_reason),'') is null then
    raise exception 'A reason is required to void a payment';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_payment_records on public.job_payments;
create trigger trg_protect_payment_records
before update on public.job_payments
for each row execute function private.protect_payment_records();

-- Keep direct admin writes to time entries, and reject an open shift if this
-- employee already has an open shift (prevents accidental duplicate clock-ins).
create unique index if not exists idx_time_entry_one_open_per_employee
on public.time_entries(employee_id) where ended_at is null;

commit;
-- No API keys or actual payroll details should go into the GitHub repository.
-- This module is bookkeeping ONLY: it never calculates taxes or tax withholding.
