# Manual acceptance tests — Cleaning Manager V2

Use **fictional demo data**. Do not change actual business records or enter home access codes.

## Preparation

1. Run `git status --short` in `cleaning-manager-v2`. If blank, run `git pull --ff-only origin feat/admin-mvp-secure`.
2. Open the repo's `supabase/migrations/20261118_finance_time.sql`, copy all SQL into **Supabase > Cleaning Manager > SQL Editor > New query > Run**.
3. Restart `npm run dev` and sign in at http://localhost:3000/login.
4. Sidebar should show: Inicio, Calendario, Trabajos, Clientes, Propiedades, Empleados, Horas, Pagos, Reportes.
5. If new pages show missing table or permission denied, recheck the migration and the Supabase project; never grant anonymous read permissions.

## A. Clients and properties

- Create a fictitious `Cliente Demo`. Edit the phone/notes and refresh.
- Under the client create `Casa Demo` at a fictional address: $180 normal price, 180 minutes estimated.
- Write distinct employee notes and owner-private notes. Edit both.
- Search the new property under Propiedades. Verify it links to the correct client.

## B. Jobs / calendar

- Create a $180 job for Casa Demo tomorrow at 9:00–12:00 assigned Maria and Ana; status Por confirmar.
- Open Calendario for that week. Confirm the visit appears once on the correct date.
- Click Confirmar. It should become Confirmado.
- Click Mover and change the date; it should become Por confirmar again.
- Create another job for Maria at an overlapping time. Attempt to reschedule this job onto it; a warning should appear (not an automatic block).
- Filter the calendar by Maria. Click Imprimir semana and inspect print preview (do not share real addresses).
- Cancel the second job and give a reason. It should remain in the record with Ver cancelados checked.
- Duplicate the original job; check that the old job is unchanged.

## C. Payments

- Mark the $180 demo job Terminado.
- Register $50 cash: expected remaining balance $130.
- Register $30 Venmo: expected remaining balance $100.
- Register a $100 check: expected remaining balance $0 and $100 in pending checks.
- Mark that check cleared; pending checks should fall by $100.
- Void the $30 Venmo entry with an explanation: expected balance returns to $30 and the void stays visible.
- Cash/paid-month reporting uses the payment received date, not the work date.

## D. Hours

- Manually enter Maria 9:00–12:00 with a 30-minute unpaid break. Expected 2.50 hours.
- Mark arrival for Ana with the admin control, then mark departure. The open shift should close.
- Edit the recorded time. Export CSV and verify the rows locally.
- Do not infer tax withholding or overtime from the displayed hours.

## E. Reports and reminders

- Select the payments' month in Reportes. Check payment-method totals and recorded hours.
- Inicio should show work to confirm, any open shifts and pending checks.
- Resize your browser to a narrow width. Calendar days should stack into readable cards.

## F. Access control

- Sign out and try visiting /clients, /payments and /hours. You should be redirected to /login.
- Use only accounts on admin_users. Disable public signups in Supabase Auth settings.
- Use Supabase's Security Advisor and confirm RLS/GRANTs on public clients, properties, employees, jobs, job_payments and time_entries.
- A green UI is not a complete security audit: validate API permissions before importing any customer data.

## Reporting a failure

Send the page name, what you clicked, what you expected, the actual error text, and a screenshot **cropped to exclude personal data and any credentials**.

## Known missing features

Automatic invoices/quotes, staff portal, full recurring schedule engine, customer-facing marketing site, secure door code storage, employee self-check-in, automated reminders, bank reconciliation, taxes, wage calculations and payroll are future stages. Data lists are capped at 500 recent payments/hours.
