# KD FacilityOS — Architecture (Phase 1)

**Brand:** KD Facilities Management Services  
**Tagline:** Cleaner Spaces | Safer Spaces | Better Living  
**Product:** Multi-tenant facility-management SaaS (not generic HR)

## Current stack (kept)

The repo is already a working Vite + React + TypeScript + Tailwind + Supabase app with Auth, four portals, and operational tables. Phase 1 does **not** rewrite it to Next.js. A framework migration would reset login and live portals. The product architecture is layered onto this codebase.

| Layer | Choice |
| --- | --- |
| App | React 19 + Vite + TypeScript |
| Routing | react-router-dom |
| Data / Auth / Storage / Realtime | Supabase |
| Forms | react-hook-form + zod |
| Charts | recharts |

Target later: PWA for worker/supervisor, PDF reports, email/WhatsApp adapters. Not in Phase 1.

## Tenant model

```
Organization (facility-management company)
  └── Clients (site owners / RWAs / corporates)
        └── Sites (office, hospital, warehouse, …)
              └── Employees, attendance, tasks, inspections, complaints, contracts
```

- `super_admin` is the **platform** operator (KD). Can see every organization.
- Every other user belongs to exactly one `organization_id`.
- Tenant-owned rows carry `organization_id`.
- RLS **restrictive** policies AND with existing site/role policies so a user cannot read another org even if a site-level policy would allow it.

## Authentication strategy

1. Supabase Auth (email/password, recovery).
2. `profiles` extends `auth.users` (role, org, name, photo).
3. `handle_new_user` trigger copies `raw_user_meta_data.role` and `organization_id`.
4. Auth context loads `profile` + `organization` after session restore.
5. `ProtectedRoute` redirects by **role group** (admin / client / supervisor / worker).
6. Frontend checks are UX only. Postgres RLS is the authority.

## Folder structure (Phase 1 additions)

```
src/lib/auth/roles.ts          Role groups and portal homes
src/lib/permissions.ts         UI capability helpers
src/pages/admin/Organizations  Platform org registry
src/pages/admin/Settings       Current organization settings
docs/                          Architecture, schema, roles
supabase/migrations/004_…      Tenant foundation
```

Existing `src/pages/{admin,client,supervisor,worker,security}` stay. New modules (inventory, training) wait for later phases.

## What Phase 1 is / is not

**In scope:** organizations, organization_settings, expanded roles, `organization_id` + RLS isolation, audit_logs, org settings UI, auth context org awareness.

**Out of scope (later phases):** replacements, training, Next.js/shadcn rewrite.

## Phase 3 — Shifts, roster, attendance

- `shifts` (morning / afternoon / evening / night / custom) and `rosters` (employee + shift + site + weekday).
- Attendance stores `shift_id`, `location_verified`, and checkout coordinates.
- Late is measured from the assigned shift start + grace, not a hard 09:30.
- GPS is captured only on check-in / check-out. No continuous tracking.
- Worker home shows today’s site, today’s shift, and separate check-in / check-out.
- Supervisor board: Scheduled / Present / Absent / Late / Not checked in.
- Admin: Shifts, Roster, and attendance columns for shift + verified.

## Phase 4 — Tasks, checklists, supervisor dashboard

- Tasks gain title, priority, created_by, recurrence (none/daily/weekly), and statuses todo / in_progress / completed (overdue is derived from due date).
- Reusable `checklist_templates` + items (corporate, warehouse, residential seeded). Site-specific lists allowed.
- Completing a recurring task clones the next occurrence via `spawn_recurring_task`.
- Admin: Tasks and Checklists pages. Org admins can write tasks (not only supervisors).
- Supervisor home is an operations dashboard (attendance + open work + sites).
- Worker home lists today’s assigned tasks under check-in.

## Phase 5 — Complaints, inspections, photos

- Inspections have area items (Cleanliness, Washroom, Floor, Pantry, Waste), multiple photos, draft/submitted/reviewed, and a supervisor **overall_score**.
- AI score stays a labelled suggestion. The provider swap is Phase 10.
- Complaints: category, title, priority, photos, assignee, comments, workflow open → assigned → in progress → resolved → client confirmed → closed.
- Storage bucket `complaint-photos`. Inspection photos live in `inspection-photos` plus `inspection_photos` rows.
- Admin Inspections page. Client can confirm a resolved complaint.

## Phase 6 — Client portal + monthly reports

- Client home shows today’s workforce, attendance, open complaints, task completion, inspection score, SLA, recent photos, and shortcuts to reports / invoices / contracts.
- `monthly_reports` stores one row per client+site+month plus a client roll-up (`site_id` null).
- Generate from the client Reports page or Admin → Reports. Print / Save PDF opens a print-ready sheet (browser “Save as PDF”).
- SLA % = average of (inspections scoring ≥ 80) and (complaints resolved in the period).

## Phase 7 — Admin analytics

- Admin home is the operations analytics dashboard. No new tables — KPIs and charts read existing org-scoped rows.
- KPIs: clients, sites, employees, today’s attendance, open complaints, average site score, SLA (same 80 / resolved formula as monthly reports, last 30 days), this month’s invoice total, contracts ending in 60 days.
- Charts: stacked attendance, opened vs resolved complaints, site quality bars, 6-month revenue, client growth, absenteeism.

## Phase 8 — Security

- Tables: `security_checkpoints`, `security_patrols`, `security_patrol_checks`, `security_incidents`, `visitors`.
- Guards use a dedicated `/security` portal: check-in, patrol checkpoint verification (GPS on verify), incident photos, visitor in/out.
- Admin → Security: guards, checkpoints, patrols, incidents, visitors.
- Supervisors see site patrols/incidents/on-site guests. Clients get a read-only security view.
- Demo guard: `guard@example.com` / `FacilityOS@2026`.

## Phase 9 — Assets, inventory, contracts, invoices

- `inventory_items` + `inventory_transactions` (in / out / adjust). Low stock when quantity ≤ minimum.
- `assets` + `asset_maintenance` for machines (serial, warranty, service dates).
- Contracts gain site, monthly value, services, manpower, renewal, status. Invoices gain number, tax, discount, total, due date, overdue/cancelled.
- Admin → Inventory / Assets. Supervisor can issue stock. Payments stay Coming soon. Training is not in this phase.

## Phase 10 — AI inspection

- `AIInspectionService` is provider-agnostic: optional OpenAI Vision, optional `ai-inspection` Edge Function, then a local heuristic fallback.
- Workflow: upload photo → analyze → detected issues → suggested score → recommended actions → supervisor apply/edit → submit.
- Result is labelled **AI-generated**. `ai_score` / `ai_feedback` are suggestions. `overall_score` stays supervisor-owned.
- No new tables. Optional env: `VITE_AI_INSPECTION_PROVIDER`, `VITE_OPENAI_API_KEY`, `VITE_OPENAI_MODEL`.
- Browser OpenAI keys are demo-only. Production should deploy `supabase/functions/ai-inspection` with `OPENAI_API_KEY`.
