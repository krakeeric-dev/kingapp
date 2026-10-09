# Supabase files

- `schema.sql`: the original hand-kept schema. Unchanged.
- `migrations/`: ordered SQL files for creating a **new, empty** project (the test copy). Run them in filename order.

The migrations are reconstructed from `schema.sql` plus six tables the app code writes to that `schema.sql` lacks (`delivery_*`, `customer_*`). They are not an export of the live database. Never run them on the live project.

## Create the test project from the migrations

In the test project's dashboard, open SQL Editor and run each file in `migrations/` in order (`...0001` to `...0005`). Then set the test project's URL and anon key as described in `docs/DEPLOY.md`.

With the Supabase CLI instead: `supabase link --project-ref <TEST project ref>` then `supabase db push`. Check the project ref twice. It must be the test project.

## Export the real live structure (read only)

This reads the live database and changes nothing. Run it yourself, not Claude, because it needs the live database password.

```bash
supabase db dump --schema public --db-url "postgresql://postgres:<password>@db.<live-ref>.supabase.co:5432/postgres" -f supabase/live-schema-dump.sql
```

Do not commit that file (the repo is public). Compare it with `migrations/` and tell Claude what differs.

## Read-only checks to paste into the live project's SQL Editor

Which tables exist, and is Row Level Security on:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
```

Which policies exist:

```sql
select tablename, policyname, cmd, qual from pg_policies where schemaname = 'public' order by tablename, policyname;
```

Is the default admin password still in place:

```sql
select id, payload->>'username' as username, (payload->>'password' = 'admin123') as default_password from public.users;
```
