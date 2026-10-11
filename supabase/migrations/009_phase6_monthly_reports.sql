-- Phase 6: persisted monthly site reports for the client portal
-- Run after 008_phase5_inspections_complaints.sql

create table if not exists public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  workers_deployed integer not null default 0,
  attendance_present integer not null default 0,
  attendance_expected integer not null default 0,
  attendance_pct numeric,
  tasks_completed integer not null default 0,
  tasks_pending integer not null default 0,
  complaints_total integer not null default 0,
  complaints_resolved integer not null default 0,
  avg_inspection_score numeric,
  sla_compliance_pct numeric,
  photo_urls jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create index if not exists monthly_reports_organization_id_idx on public.monthly_reports (organization_id);
create index if not exists monthly_reports_client_id_idx on public.monthly_reports (client_id);
create index if not exists monthly_reports_site_id_idx on public.monthly_reports (site_id);
create unique index if not exists monthly_reports_scope_idx
  on public.monthly_reports (
    organization_id,
    client_id,
    coalesce(site_id, '00000000-0000-0000-0000-000000000000'),
    period_start
  );

alter table public.monthly_reports enable row level security;

drop trigger if exists set_organization_id on public.monthly_reports;
create trigger set_organization_id before insert on public.monthly_reports
  for each row execute function public.set_organization_id();

drop policy if exists monthly_reports_select on public.monthly_reports;
create policy monthly_reports_select on public.monthly_reports
  for select to authenticated
  using (
    public.is_org_admin()
    or client_id in (select public.my_client_ids())
  );

drop policy if exists monthly_reports_write on public.monthly_reports;
create policy monthly_reports_write on public.monthly_reports
  for all to authenticated
  using (
    public.is_org_admin()
    or client_id in (select public.my_client_ids())
  )
  with check (
    public.is_org_admin()
    or client_id in (select public.my_client_ids())
  );

select public.add_org_isolation('monthly_reports');

grant select, insert, update, delete on public.monthly_reports to authenticated;
