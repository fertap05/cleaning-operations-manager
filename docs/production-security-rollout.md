# Owner-only production rollout plan

**A passing build does NOT certify security. This plan has not been executed against the live Supabase instance.**

## Gate A — Only three administrators

- Disable public self-signup under Supabase Auth. Create exactly two owners and one developer account via admin invitation.
- Inspect `public.admin_users` using `docs/security-inventory.sql` and confirm counts: 2 owner, 1 developer, 0 extras.
- Review Supabase project collaborators, GitHub collaborators, Vercel collaborators and API keys separately. The app's 3-user allowlist does not constrain cloud project administrators.
- Unique long passwords stored privately. No shared login.
- Enroll and verify TOTP MFA for each of the three (authenticator app). Test sign-out/sign-in.
- Only AFTER all three can verify MFA, test `20261118_enforce_mfa.sql` in STAGING, then later apply it to PRODUCTION. Applying prematurely can lock people out.
- Test Supabase REST for: (1) anonymous no JWT, (2) nonmember JWT, (3) admin JWT at aal1, (4) admin JWT at aal2. All but (4) must be denied access to business data once enforcement is active.

## Gate B — Confidentiality and audit

- Run `docs/security-inventory.sql` and inspect ALL RLS policies and GRANTs, including any custom policies beyond our demo setup. Do not assume known policy names are exhaustive.
- Do not expose secret/service_role keys in the browser, commits, screenshots or deployment previews.
- Do not enter real alarm or door codes in `properties.access_code`; that prototype column stores plaintext. Deploy a properly protected server-side encrypted vault and a read audit before enabling codes.
- Add change logs for client, jobs, property, and payment-sensitive events before production use. Time corrections and voids get an audit in `20261118_time_audit_void.sql`.
- Configure provider protections: auth rate limits, custom SMTP when needed, alerts, multi-factor authentication for developer/cloud accounts, and device protection.

## Gate C — Separate testing from production

**First blocker:** our very first database tables were created by hand. See [schema baseline instructions](schema-baseline.md) before attempting a fresh STAGING project; the repository cannot reliably rebuild the whole schema yet.

- Create two **different Supabase projects** with distinct user pools: STAGING and PRODUCTION. No customer data in STAGING.
- Use a managed host with distinct Preview/Production environment variables, e.g. Vercel. Keep branch previews restricted to testers.
- NEVER aim a preview deployment at the production DB.
- Release path: feature branch -> CI (lint/build) -> staging integration tests -> approval -> production release.
- Use additive/backward-compatible SQL migrations before application updates. Roll back code via hosting platform on failure; code rollbacks do NOT reverse database migrations.
- Schedule changes with owners and provide a paper fallback for any breaking migration.

## Gate D — Recovery and compliance

- Confirm actual subscription provides backups and PITR/restore level needed. Free plans may not offer downloadable backups.
- Make encrypted backups to a destination separate from GitHub and test restore into a new project.
- Assign owners for incidents, missing payments, unavailable app, lost MFA factors, and data breach reports.
- Keep a record of who has access, where production secrets live, and how to revoke a stolen session.
- Payroll and overtime calculation must be reviewed by a qualified payroll professional; current hours are not payroll.

## Gate E — Rollout and acceptance

- Apply `20261118_time_audit_void.sql` in STAGING, then test `docs/security-test-plan.md`.
- Verify mobile readability, scheduling conflicts, cash/check/Venmo reconciliation, void audit and exports.
- Pilot with fake data, then a small controlled customer dataset only after the other gates pass.
- Do not use local `localhost` as the owners' business-wide production deployment.
