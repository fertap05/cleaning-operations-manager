-- Cleaning Manager: secure MVP migration
-- Run once in Supabase SQL Editor before using real data.
-- Existing clients/properties/employees/jobs/assignments remain intact.
begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('developer','owner')),
  created_at timestamptz not null default now()
);

alter table public.jobs add column if not exists cancellation_reason text;
alter table public.jobs add column if not exists original_job_id uuid references public.jobs(id);
alter table public.jobs add column if not exists private_notes text;
alter table public.jobs add column if not exists employee_notes text;
alter table public.jobs add column if not exists is_extra_job boolean not null default false;

create or replace function private.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
      and role in ('developer','owner')
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

alter table public.admin_users enable row level security;
drop policy if exists "members see their account" on public.admin_users;
create policy "members see their account"
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));
revoke all on public.admin_users from public, anon;
grant select on public.admin_users to authenticated;

-- Remove the temporary public-read policies from the prototype.
drop policy if exists "Allow public read clients" on public.clients;
drop policy if exists "Allow public read properties" on public.properties;
drop policy if exists "Allow public read employees" on public.employees;
drop policy if exists "Allow public read jobs" on public.jobs;
drop policy if exists "Allow public read job assignments" on public.job_assignments;

alter table public.clients enable row level security;
alter table public.properties enable row level security;
alter table public.employees enable row level security;
alter table public.jobs enable row level security;
alter table public.job_assignments enable row level security;

-- GRANTs and RLS are both necessary. The public anon role receives no access.
revoke all on public.clients, public.properties, public.employees,
  public.jobs, public.job_assignments from anon;
revoke all on public.clients, public.properties, public.employees,
  public.jobs, public.job_assignments from public;
grant select, insert, update, delete on public.clients, public.properties,
  public.employees, public.jobs, public.job_assignments to authenticated;

do $$
declare tab text;
begin
  foreach tab in array array['clients','properties','employees','jobs','job_assignments']
  loop
    execute format('drop policy if exists "admin access" on public.%I', tab);
    execute format(
      'create policy "admin access" on public.%I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',
      tab
    );
  end loop;
end $$;

-- Atomic job + employee assignment updates.
-- Admin authorization and row policies apply to every SQL statement.
create or replace function public.save_job(
  p_property_id uuid,
  p_job_date date,
  p_start_time time,
  p_end_time time,
  p_status text,
  p_price numeric,
  p_employee_ids uuid[],
  p_job_id uuid default null,
  p_employee_notes text default null,
  p_private_notes text default null,
  p_is_extra_job boolean default false,
  p_cancellation_reason text default null
)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_property_id is null or p_job_date is null then
    raise exception 'Property and date required';
  end if;
  if p_start_time is not null and p_end_time is not null
      and p_end_time <= p_start_time then
    raise exception 'End time must be later than start time';
  end if;
  if p_status not in ('scheduled','pending_confirmation','confirmed',
                      'in_progress','completed','cancelled') then
    raise exception 'Invalid job status';
  end if;

  if p_job_id is null then
    insert into public.jobs
      (property_id, job_date, start_time, estimated_end_time, status,
       price, employee_notes, private_notes, is_extra_job, cancellation_reason)
    values
      (p_property_id, p_job_date, p_start_time, p_end_time, p_status,
       p_price, p_employee_notes, p_private_notes, p_is_extra_job, p_cancellation_reason)
    returning id into v_id;
  else
    update public.jobs set
      property_id = p_property_id, job_date = p_job_date,
      start_time = p_start_time, estimated_end_time = p_end_time,
      status = p_status, price = p_price,
      employee_notes = p_employee_notes, private_notes = p_private_notes,
      is_extra_job = p_is_extra_job, cancellation_reason = p_cancellation_reason,
      updated_at = now()
    where id = p_job_id returning id into v_id;
    if v_id is null then
      raise exception 'Job not found';
    end if;
  end if;

  delete from public.job_assignments where job_id = v_id;
  insert into public.job_assignments(job_id, employee_id)
  select v_id, u.employee_id
  from (select distinct x as employee_id
        from unnest(coalesce(p_employee_ids, array[]::uuid[])) as x) u;
  return v_id;
end;
$$;

revoke all on function public.save_job(uuid,date,time,time,text,numeric,uuid[],uuid,text,text,boolean,text) from public, anon;
grant execute on function public.save_job(uuid,date,time,time,text,numeric,uuid[],uuid,text,text,boolean,text) to authenticated;

commit;

-- IMPORTANT BOOTSTRAP: create each user under Authentication > Users first.
-- Then run this separately, replacing the placeholder with your own email:
-- insert into public.admin_users(user_id, role)
-- select id, 'developer' from auth.users where email = 'YOUR_EMAIL_HERE'
-- on conflict (user_id) do update set role = excluded.role;
--
-- IMPORTANT: do not import real door codes yet. The current prototype
-- stores access_code as plaintext. A later version should use secure
-- server-side storage and explicit access auditing.
