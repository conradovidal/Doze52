This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Supabase environments

All Supabase configuration is read only from:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Use different values by environment:

1. Local (`.env.local`)
- point both vars to the **Doze52 Dev** Supabase project.
2. Vercel Preview
- set both vars in the **Preview** environment to the **Doze52 Dev** project.
3. Vercel Production
- set both vars in the **Production** environment to the **Doze52 Prod** project.

Behavior:

- In non-production, the app logs `[supabase] <NEXT_PUBLIC_SUPABASE_URL>` once in the browser console.
- In production, this log is disabled.
- If vars are missing, the app keeps running and shows a warning in the home UI:
  `Supabase nao configurado neste ambiente.`
- Never expose `service_role` in frontend env vars or client code.

## Environment badge

1. Local: set `NEXT_PUBLIC_APP_ENV=local` and `NEXT_PUBLIC_SHOW_ENV_BADGE=true`.
2. Vercel Preview: set `NEXT_PUBLIC_APP_ENV=dev`.
3. Vercel Production: set `NEXT_PUBLIC_APP_ENV=prod`.
4. In production, the badge only appears when `NEXT_PUBLIC_SHOW_ENV_BADGE=true`.
5. Valid values for `NEXT_PUBLIC_APP_ENV`: `local | dev | prod`.

## OAuth local/preview/prod checklist

1. Supabase Auth URL Configuration:
- Site URL = current environment URL.
- Redirect URLs include:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/callback/popup`
  - `http://localhost:3000/auth/popup-callback`
  - `http://127.0.0.1:3000/auth/callback`
  - `http://127.0.0.1:3000/auth/callback/popup`
  - preview/prod equivalents for `/auth/callback`, `/auth/callback/popup`, and `/auth/popup-callback`.
2. Google Cloud OAuth client:
- Authorized redirect URIs: `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`.
- Authorized JavaScript origins: `https://<SUPABASE_PROJECT_REF>.supabase.co`.
3. Preview wildcard (optional, Supabase permitting): `https://*-<team-or-project>.vercel.app/auth/callback*`.
4. Validate in browser Network:
- Supabase `/auth/v1/authorize` must send `redirect_to=<current-origin>/auth/callback/popup`.
- Never allow preview/prod to send `redirect_to=http://localhost:3000/...`.
5. Stage/Preview `NEXT_PUBLIC_SUPABASE_URL` must point to the same Supabase project where these redirect URLs were configured.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Supabase migrations and backup

Before changing schema in production, create backup dumps:

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" --schema public --file supabase/backups/schema_YYYYMMDD.sql
pg_dump "$SUPABASE_DB_URL" --data-only --table public.categories --table public.events > supabase/backups/data_YYYYMMDD.sql
```

Apply migrations:

```bash
supabase db push
```

Version all SQL migrations in `supabase/migrations/`.

Security audit quick check:

```bash
rg -n "service_role|SUPABASE_SERVICE_ROLE|sb_secret|sbp_"
```

## Supabase DEV migrations (categories/events)

1. Apply migrations to DEV:
- `supabase link --project-ref <DEV_REF>`
- `supabase db push`
2. Confirm tables used by sync (`loadRemoteData`, `saveSnapshot`, `exportUserData`):
- `public.categories`
- `public.events`
3. Confirm minimum RLS/policies per table:
- RLS `enabled` and `force`.
- Policies `SELECT/INSERT/UPDATE/DELETE` with `auth.uid() = user_id`.
4. Confirm environment points to the same DEV project:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Validate after login:
- home loads without `Banco DEV sem tabelas/migrations...`
- create/update/delete category/event persists after reload.
