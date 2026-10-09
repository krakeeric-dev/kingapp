# Deploying KingApp on Vercel

Hosting is Vercel. The repo is `krakeeric-dev/kingapp`, connected to a Vercel project whose live site is `kingapp-delta.vercel.app`. Nothing in this repo needs a Vercel config file: Vercel detects Next.js and uses `npm run build`.

## One-time setup (Vercel dashboard)

1. Open the project in Vercel, then Settings, Git. Confirm the repo is `krakeeric-dev/kingapp` and the Production Branch is `main`.
2. Settings, Environment Variables. Set the two Supabase variables **separately for each environment**:

   | Variable | Production | Preview | Development |
   | --- | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | LIVE project URL | TEST project URL | TEST project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | LIVE anon key | TEST anon key | TEST anon key |

   Untick Preview and Development when you enter the live values, and untick Production when you enter the test values. Use the **anon (public)** key from Supabase, Project Settings, API. Never use the `service_role` key.
3. Optional, only if you use telephony: `TELEPHONY_PROVIDER` and the other names in `.env.example`, set for Production only. Leave them empty while the provider is `mock`.
4. After changing a variable, redeploy. Variables apply only to new builds.

## Preview link for every branch

Vercel builds every pushed branch automatically and gives it its own address, with the form `kingapp-git-<branch>-<team>.vercel.app`. The link is on the branch's commit in GitHub (the Vercel check, "Visit Preview") and in the Vercel dashboard under Deployments. Because of step 2, previews use the **test** database, so testing a branch cannot change live data.

Check this once: open a preview, add a test record, and confirm it appears in the test project's table and not in the live one.

## Deploy a change

1. Work on a branch, never `main`. Push the branch: `git push -u origin <branch>`.
2. Open the preview link on your phone and laptop and test.
3. When you are happy, merge the branch to `main` on GitHub. Vercel deploys `main` to production by itself.
4. If something is wrong, in Vercel open Deployments, pick the last good deployment and choose "Promote to Production" (or Instant Rollback).

## Run on a laptop

```bash
npm install
cp .env.example .env.local     # then fill in the TEST project's URL and anon key
npm run dev                    # http://localhost:3000/login
```

Before pushing: `npm run typecheck` and `npm run build`. (`npm run lint` currently reports 8 errors that were there before Phase 1: missing rule definitions in `eslint.config.mjs`.)

## Database changes

Never apply a migration to the live project from a branch. The order is: write the SQL in `supabase/migrations/`, run it on the test project, test the preview, take a fresh backup of the live project, then apply it to live at a time you choose.

## Vercel plan

The free Hobby plan is for non-commercial use only. Real clients mean Vercel Pro (about $20 a month). Check which plan this project is on in Vercel, Settings, Billing.
