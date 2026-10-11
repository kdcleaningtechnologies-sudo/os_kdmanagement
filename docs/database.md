# Database foundation (Phase 1)

## New tables

### organizations
id, name, logo_url, phone, email, address, website, tagline, status, created_at, updated_at

### organization_settings
organization_id (unique), timezone, currency, default_geofence_meters, updated_at

### audit_logs
id, organization_id, profile_id, action, module, record_table, record_id, metadata, created_at

## Tenant column

`organization_id` is added to:

profiles (nullable only for `super_admin`), companies, clients, sites, employees, attendance, tasks, inspection_reports, complaints, leave_requests, contracts, invoices, announcements, notifications

A BEFORE INSERT trigger fills `organization_id` from `current_organization_id()` when the client omits it.

## Isolation

1. Existing **permissive** policies (site / client / employee scope) stay.
2. New **restrictive** policies require `is_super_admin() OR organization_id = current_organization_id()`.

Restrictive + permissive = AND. That is the tenant wall.

## Indexes

`organization_id` is indexed on every tenant table listed above.

## Phase 2 directory columns

**clients:** contact_person, address, gst_number, status (active/inactive). Deactivate instead of delete.

**sites:** site_type expanded (corporate, residential, hospital, hotel, retail, school, factory, warehouse, commercial), geofence_radius, supervisor_id, status.

**employees:** job_title, department, emergency_contact (admin only), supervisor_id, employment_status. `designation` remains worker/supervisor/security_guard for RLS.

Also: `client_contacts`, `employee_documents`.

## Phase 3 shifts + attendance

### shifts
id, organization_id, site_id (null = org-wide), name, kind (morning/afternoon/evening/night/custom), start_time, end_time, grace_minutes, status, created_at

### rosters
id, organization_id, employee_id, shift_id, site_id, weekday (0=Sun, null=every day), effective_from, effective_to, status, created_at

### attendance additions
shift_id, location_verified, check_out_lat, check_out_lng

Seed: KD Morning 07:00–15:00, Afternoon 14:00–22:00, Evening 16:00–00:00, Night 22:00–06:00. Active workers/guards are rostered to Morning.

## Phase 4 tasks + checklists

### checklist_templates
id, organization_id, name, site_type, site_id, status, created_at

### checklist_template_items
id, template_id, organization_id, label, sort_order

### tasks additions
title, priority (low/medium/high/urgent), created_by, recurrence (none/daily/weekly), checklist_template_id

Status values: todo, in_progress, completed, overdue (legacy `pending` still accepted). Overdue is also derived in the UI when due_date is past and the task is not completed.

`spawn_recurring_task(task_id)` clones a completed daily/weekly task with checklist items reset.

## Phase 5 inspections + complaints

### inspection_reports additions
status (draft/submitted/reviewed), overall_score, category

### inspection_items
id, inspection_id, organization_id, category, score, remarks, status (pending/pass/fail/needs_attention), sort_order

### inspection_photos
id, inspection_id, inspection_item_id, organization_id, photo_url, storage_path, caption

### complaints additions
title, category, priority, assigned_to, created_by, photos jsonb

Status: open, assigned, in_progress, resolved, client_confirmed, closed

### complaint_comments
id, complaint_id, organization_id, profile_id, body, created_at

Storage: `complaint-photos` (public read, authenticated write)

## Phase 6 monthly reports

### monthly_reports
id, organization_id, client_id, site_id (null = client roll-up), period_start, period_end, workers_deployed, attendance_present, attendance_expected, attendance_pct, tasks_completed, tasks_pending, complaints_total, complaints_resolved, avg_inspection_score, sla_compliance_pct, photo_urls, generated_at

Unique on (organization_id, client_id, coalesce(site_id, zero-uuid), period_start).

## Phase 7 analytics

No new tables. Admin dashboard aggregates clients, sites, employees, attendance, complaints, inspection_reports, invoices, and contracts.

## Phase 8 security

### security_checkpoints
id, organization_id, site_id, name, location_hint, sort_order, status

### security_patrols
id, organization_id, site_id, guard_id, status (scheduled/in_progress/completed/missed), started_at, completed_at, notes

### security_patrol_checks
id, organization_id, patrol_id, checkpoint_id, checked_at, status (pending/verified/skipped/missed), latitude, longitude, notes

### security_incidents
id, organization_id, site_id, guard_id, incident_type, description, photo_url, photos, severity, status

### visitors
id, organization_id, site_id, visitor_name, phone, purpose, host, vehicle_number, entry_time, exit_time, logged_by, status (on_site/exited)

Storage: `incident-photos` (public read, authenticated write)

## Phase 9 assets + inventory

### inventory_items
id, organization_id, site_id, name, category (chemical/gloves/mop/bags/tissue/ppe/equipment), quantity, minimum_quantity, unit, status

### inventory_transactions
id, organization_id, item_id, site_id, kind (in/out/adjust), quantity, note, created_by

### assets
id, organization_id, site_id, asset_code, name, serial_number, purchase_date, warranty_end, last_service, next_service, condition, status, notes

### asset_maintenance
id, organization_id, asset_id, service_date, next_service, cost, notes

Contracts also: site_id, monthly_value, services, manpower, renewal_date, status.
Invoices also: site_id, invoice_number, tax, discount, total, due_date. Status adds overdue, cancelled.

## Later-phase tables (not created yet)

replacement_requests, training, sla_rules, payments
