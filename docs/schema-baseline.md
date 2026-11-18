# Missing baseline schema — blocker before a separate STAGING database

The first `clients`, `properties` and `employees` tables were created manually in Supabase SQL Editor during the early prototype. Their CREATE TABLE definitions were not committed to the repository. Our current `20261117_secure_admin_mvp.sql` migration assumes these tables already exist.

**Do not assume this repository can recreate a fresh database from scratch yet.** This is a production-readiness blocker.

## Safe solution

1. Start with a READ-ONLY schema inventory in the existing Cleaning Manager project. See `docs/security-inventory.sql`.
2. Capture an accurate **schema-only** baseline (tables, columns, indexes, constraints, functions, grants and policies) from the current database with the supported Supabase CLI `db pull` / `db dump` workflow. Do not export data.
3. If using CLI, back up and inspect the existing migration directory first. Because several SQL migrations were previously executed manually in SQL Editor, reconcile the remote migration history before running `db push`. Supabase migration tracking is not automatic for SQL Editor executions.
4. Review the generated baseline locally. Remove irrelevant extension schemas and any embedded confidential literals; do **not** add actual clients or credentials to source control.
5. Use that reviewed baseline to build a NEW staging Supabase project from scratch and verify all constraints, policies and functions work with fictitious sample data.
6. Commit reviewed schema migrations. Then put new database changes only in versioned migrations that can be tested and safely promoted.

## Never run without a restore plan

- Never execute `supabase db reset --linked` against the current company project.
- Do not run an arbitrary `supabase db push` against the real existing project when migrations have been applied manually and history is unverified.
- Do not copy production customer data or door codes to staging.
- Do not post database connection URIs or passwords in issues, source files or chat screenshots.

Official docs: https://supabase.com/docs/guides/local-development/cli-workflows and https://supabase.com/docs/guides/deployment/database-migrations
