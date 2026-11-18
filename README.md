# Cleaning Operations Manager

Private, Spanish-first operations software for a small house, office, church and rental cleaning company.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Supabase Auth, PostgreSQL with RLS.

## Implemented in V2 feature branch

- Allowlisted owner/developer login (no public signup UI)
- Clients and properties: search, add, edit, price/duration and separated notes
- Employees, owner participation and flexible crews
- Jobs: create, update, duplicate, confirm, reschedule or cancel with reason
- Weekly calendar: employee filter, printable weekly schedule, overlap warnings
- Dashboard: work to confirm, jobs without crew, past unfinished jobs, open shifts and pending checks
- Payments: cash, check, Venmo, other, partial payments, check deposit status, void corrections with recorded reasons
- Hours: owner-managed arrivals/departures, manual shift corrections and CSV export
- Monthly reports: received money by method, completed work, employee hours, CSV

**Not yet implemented:** customer portal, public EN/ES marketing website, invoice/quote generation, secure home-code vault, automatic SMS/email reminders, route optimization, employee self-service punch-in, advanced recurring schedule generation, full payroll/taxes, bank reconciliation, file storage.

## Installation / update on Windows

In `C:\Users\ferch\Documents\Projects\cleaning-manager-v2`, first inspect changes:

```powershell
git status --short
```

If blank, update:

```powershell
git pull --ff-only origin feat/admin-mvp-secure
npm install
npm run dev
```

Keep your existing `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never commit credentials or use a secret key in browser code.

## Database: IMPORTANT before opening new pages

You already ran `supabase/migrations/20261117_secure_admin_mvp.sql` to configure login. This preserved the original clients/properties/jobs and closed the temporary anonymous read access.

**New migration:** open `supabase/migrations/20261118_finance_time.sql`, copy its entire content into the **Cleaning Manager** Supabase SQL Editor, and run it once. It creates `job_payments` and `time_entries` with RLS. It does not delete existing job, client or employee data.

If tables have been independently modified, back up and inspect them before applying the migration. Do not reopen `anon` permissions to fix errors.

## Auth

Supabase Authentication > Users: invite the two owners. Disable public signups. Allowlist each trusted user in `public.admin_users` with role `owner`; your developer account has role `developer`. Never invite workers to an admin login. RLS is the actual access boundary.

## Bookkeeping rules

A completed cleaning with a price creates a balance due. Partial payments reduce that balance. Payments received ahead of service are recorded separately from work performed. A check is recorded as received but stays flagged until deposited/cleared. Payment corrections use void-with-reason instead of deletion.

**These are operational totals, not tax statements or bank reconciliation.** Hours are tracked without automatic tax withholding or statutory overtime/payroll calculations. Consult a qualified payroll service before real wage processing.

**Limitations:** recent payment and hour views fetch at most 500 entries; replace with server-side pagination and database aggregates before large-scale operation. Home codes must not be entered in the current plaintext access_code field. This is a development preview requiring security testing.

## Acceptance tests

Follow `docs/manual-test-plan.md`. GitHub Actions automatically checks npm install, lint, and production build; a green build cannot guarantee production behavior.

**Privacy:** The code repository is public. Never commit client addresses, phone numbers, home codes, employee timesheets, financial information or .env.local.
