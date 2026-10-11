# KD FacilityOS

Multi-portal operations platform for cleaning, housekeeping, security, and facility management.

## Stack

- React + TypeScript + Vite + Tailwind CSS
- Supabase (Auth, Postgres, Storage, Realtime)
- react-router-dom, react-hook-form, zod, recharts

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project settings.

3. In the Supabase SQL Editor, run in order:

`supabase/migrations/001_initial_schema.sql`  
`supabase/migrations/004_phase1_tenant_foundation.sql` (multi-tenant orgs + RLS)  
`supabase/migrations/005_phase2_directory.sql` (clients / sites / employees)  
`supabase/migrations/006_phase3_shifts_attendance.sql` (shifts, roster, geofenced attendance)  
`supabase/migrations/007_phase4_tasks_checklists.sql` (tasks, reusable checklists)  
`supabase/migrations/008_phase5_inspections_complaints.sql` (inspections, photos, complaint workflow)  
`supabase/migrations/009_phase6_monthly_reports.sql` (client monthly reports)

This creates tables, RLS policies, storage buckets (`inspection-photos`, `documents`), notification triggers, and Realtime on `notifications`.

4. Create the first admin user in **Authentication → Users**, then either:

- set user metadata `{ "full_name": "Ada Admin", "role": "super_admin" }` before insert (the `handle_new_user` trigger writes `profiles`), or
- update `profiles.role` to `super_admin` after signup.

5. Repeat for `client`, `supervisor`, and `worker` users. Link clients via `clients.profile_id` and staff via `employees.profile_id` + `employees.site_id` in the Admin portal.

6. In **Authentication → URL Configuration**, add `http://localhost:5173/reset-password` to redirect URLs.

7. Start the app:

```bash
npm install
npm run dev
```

## Portals

| Role | Path |
| --- | --- |
| Super admin | `/admin` |
| Client | `/client` |
| Supervisor | `/supervisor` |
| Worker | `/worker` |

Payroll and payment collection are stubbed as “Coming soon”.

## Deploy (GitHub + Vercel)

1. In the Supabase SQL Editor, run any newer files that are not applied yet, especially:
   `014_security_hardening.sql`, `015_signup_approval.sql`, `016_keep_only_admin.sql`, `017_fresh_clients.sql`, `018_sites_admin_write.sql`, `019_admin_panel_writes.sql`, `020_sites_directory_columns.sql`.
2. Supabase → Authentication → URL Configuration: add your Vercel URL and `/reset-password` (and keep `http://localhost:5173/reset-password`).
3. Push this folder to GitHub, then import the repo in Vercel as a Vite project (`npm run build`, output `dist`).
4. In Vercel → Project Settings → Environment Variables, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production, then redeploy.

Never commit `.env`. Use `.env.example` as the template.

## Demo business data

After the schema migration, run `supabase/migrations/002_seed_kd_business.sql` in the SQL Editor.

This creates two Pune clients (Westend Corporate Parks, Harmony Housing), five GPS-tagged sites, supervisors, workers, attendance history, inspections, complaints, contracts, and invoices.

If login says “Invalid login credentials”, run `supabase/migrations/003_fix_demo_logins.sql`.

Demo password for all seeded portal users: `FacilityOS@2026`

| Portal | Email |
| --- | --- |
| Client (Westend) | westend.client@example.com |
| Client (Harmony) | harmony.client@example.com |
| Supervisor | supervisor@example.com |
| Worker | worker@example.com |
