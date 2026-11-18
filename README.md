# Cleaning Operations Manager

Private, Spanish-first operations system for a small residential/commercial cleaning business. Aimed at replacing paper-based scheduling and customer notebooks.

## Current MVP (feature branch)

- Owner/developer login through Supabase Auth; allowlisted admin accounts
- Client records, searchable and editable
- Properties with separate owner-only and employee-facing notes
- Employees (including owners who can be assigned to work)
- Work orders with editable dates, start/end times, status, notes, price, and assigned crew
- Weekly calendar with navigation and overlap warnings
- Dashboard showing upcoming work and operational counts
- Responsive Spanish UI

**Not yet implemented:** employee clock-in/out, payroll/tax processing, payments, invoices, files, automated notifications, employee portal or bilingual public website. Buttons are intentionally omitted for unfinished features.

## Setup

1. Clone this repository and run npm install.
2. Create a Supabase project. In .env.local set:
   - NEXT_PUBLIC_SUPABASE_URL=...
   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   Do **not** use service role or secret API keys here.
3. In Supabase SQL Editor, run supabase/migrations/20261117_secure_admin_mvp.sql. This migrates the prototype tables created earlier and removes anonymous read access.
4. Under Supabase **Authentication → Users**, create an admin with an email and password. Disable public signups in Auth settings.
5. In SQL Editor, allowlist that specific account:

   insert into public.admin_users(user_id, role)
   select id, 'developer' from auth.users where email = 'you@example.com'
   on conflict (user_id) do update set role = excluded.role;

   Use role 'owner' for the two owners. Only invite accounts you trust.
6. Run npm run dev and open http://localhost:3000/login.

**IMPORTANT:** This repository is public. Never commit .env.local, real client data, door/alarm codes, bank records, or employee payroll details. Continue using fictional data during development.

## Safety + rollout

- RLS is the real database boundary. Hiding a UI element alone does not secure records.
- Review other Supabase policies before live deployment; the migration removes the temporary policies named in our prototype.
- This is an MVP/preview. Test scheduling and access controls in a dedicated test environment before migration.
- Run npm run lint and npm run build locally after merging the branch; no live database or production credentials are available to this coding session.
- The existing access_code column is **not** safe for real house codes. Leave it empty until secure secret storage is implemented.
- Payroll calculations and tax withholding require a licensed/qualified payroll service and professional review.

## Architecture

Next.js 16 + React 19 + TypeScript + Tailwind v4 + Supabase/PostgreSQL, with all sensitive tables restricted to allowlisted admin accounts.

Main entities:
clients → properties → jobs → job_assignments ← employees.

Job records and employee assignments are saved together by the transactional save_job RPC.
