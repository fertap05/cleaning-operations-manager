# Security and time-entry acceptance tests

These are not automated penetration tests. Use a staging Supabase project populated with fake data.

## Time entry correction

1. Update code to security branch; apply `supabase/migrations/20261118_time_audit_void.sql` in the STAGING SQL Editor.
2. The 0.00h accidental shift should still appear under Horas.
3. Click `Anular`, enter `Marcación accidental`, then confirm.
4. It disappears from normal list; using `Ver jornadas anuladas` shows a record labeled `Anulado` with a reason.
5. The valid 2.50-hour entry stays in totals and CSV. The annulled row does not.
6. Edit an active entry. Require `Motivo de corrección`. Check that modifications persist after refresh.
7. Try an immediate clock-in and clock-out (less than 1 minute); it should refuse to close without erroring the app.
8. Export hours CSV. Confirm only active entries are included.
9. Audit events are in `private.time_entry_audit` accessible to database admins, not a public or browser API.

## Three-user authorization and MFA

1. Confirm exactly 3 allowed admins (2 owner, 1 developer).
2. Enroll TOTP via login for each admin. After logout, sign in again and use the six-digit authenticator code.
3. Do NOT apply the mandatory RLS MFA migration until all three admins can use the app with verified MFA.
4. Apply `supabase/migrations/20261118_enforce_mfa.sql` to STAGING only.
5. Test anonymous requests and tokens from a non-member: cannot read or write business records.
6. Test authorized account with only password, no TOTP (aal1): cannot read or write business records.
7. Test authorized account with TOTP (aal2): only authorized operations succeed.
8. Repeat all critical checks in production after secure onboarding.

## Release safety

1. Prove that Preview environment credentials point to STAGING, never production.
2. Confirm backups can be restored to a separate DB before any production migration.
3. Test reverting a bad *app* release. DB schema rollbacks need separate migration planning.
4. On a mobile-sized browser, the calendar and payments must remain usable.
5. Confirm owner session logoff; check that unattended business devices have screen locks.

## Current limitations

No encrypted door code storage, customer-facing login, direct staff clock-in, complete payroll, bank reconciliation, auto SMS, or third-party penetration test. No guarantee of perfect security.
