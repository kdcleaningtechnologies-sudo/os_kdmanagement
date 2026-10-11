-- Phase 2: facility-management Clients, Sites, Employees
-- Run after 004_phase1_tenant_foundation.sql

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
alter table public.clients add column if not exists contact_person text;
alter table public.clients add column if not exists address text;
alter table public.clients add column if not exists gst_number text;
alter table public.clients add column if not exists status text;

update public.clients set status = 'active' where status is null;

alter table public.clients drop constraint if exists clients_status_check;
alter table public.clients
  add constraint clients_status_check check (status in ('active', 'inactive'));

alter table public.clients alter column status set default 'active';

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  title text,
  created_at timestamptz default now()
);

create index if not exists client_contacts_client_id_idx on public.client_contacts (client_id);
create index if not exists client_contacts_organization_id_idx on public.client_contacts (organization_id);
create index if not exists clients_status_idx on public.clients (status);

alter table public.client_contacts enable row level security;

drop trigger if exists set_organization_id on public.client_contacts;
create trigger set_organization_id
  before insert on public.client_contacts
  for each row execute function public.set_organization_id();

drop policy if exists client_contacts_select on public.client_contacts;
create policy client_contacts_select on public.client_contacts
  for select to authenticated
  using (public.is_super_admin() or public.same_org(organization_id));

drop policy if exists client_contacts_write on public.client_contacts;
create policy client_contacts_write on public.client_contacts
  for all to authenticated
  using (public.is_org_admin() and public.same_org(organization_id))
  with check (public.is_org_admin() and public.same_org(organization_id));

select public.add_org_isolation('client_contacts');

grant select, insert, update, delete on public.client_contacts to authenticated;

-- ---------------------------------------------------------------------------
-- Sites — facility types, geofence, supervisor, status
-- ---------------------------------------------------------------------------
alter table public.sites add column if not exists geofence_radius integer;
alter table public.sites add column if not exists supervisor_id uuid references public.employees(id) on delete set null;
alter table public.sites add column if not exists status text;

update public.sites set geofence_radius = 200 where geofence_radius is null;
update public.sites set status = 'active' where status is null;
update public.sites set site_type = 'factory' where site_type = 'industrial';

alter table public.sites drop constraint if exists sites_site_type_check;
alter table public.sites
  add constraint sites_site_type_check check (site_type in (
    'corporate',
    'residential',
    'hospital',
    'hotel',
    'retail',
    'school',
    'factory',
    'warehouse',
    'commercial'
  ));

alter table public.sites drop constraint if exists sites_status_check;
alter table public.sites
  add constraint sites_status_check check (status in ('active', 'inactive'));

alter table public.sites alter column geofence_radius set default 200;
alter table public.sites alter column status set default 'active';

create index if not exists sites_status_idx on public.sites (status);
create index if not exists sites_supervisor_id_idx on public.sites (supervisor_id);

-- ---------------------------------------------------------------------------
-- Employees — HR fields used by FM operations (not a generic HRIS)
-- designation stays worker/supervisor for RLS. job_title is the on-site role.
-- ---------------------------------------------------------------------------
alter table public.employees add column if not exists job_title text;
alter table public.employees add column if not exists department text;
alter table public.employees add column if not exists emergency_contact text;
alter table public.employees add column if not exists supervisor_id uuid references public.employees(id) on delete set null;
alter table public.employees add column if not exists employment_status text;

update public.employees set employment_status = 'active' where employment_status is null;

alter table public.employees drop constraint if exists employees_employment_status_check;
alter table public.employees
  add constraint employees_employment_status_check
  check (employment_status in ('active', 'inactive', 'terminated'));

alter table public.employees alter column employment_status set default 'active';

alter table public.employees drop constraint if exists employees_designation_check;
alter table public.employees
  add constraint employees_designation_check
  check (designation in ('worker', 'supervisor', 'security_guard'));

create index if not exists employees_employment_status_idx on public.employees (employment_status);
create index if not exists employees_supervisor_id_idx on public.employees (supervisor_id);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  name text not null,
  file_url text,
  created_at timestamptz default now()
);

create index if not exists employee_documents_employee_id_idx on public.employee_documents (employee_id);

alter table public.employee_documents enable row level security;

drop trigger if exists set_organization_id on public.employee_documents;
create trigger set_organization_id
  before insert on public.employee_documents
  for each row execute function public.set_organization_id();

drop policy if exists employee_documents_select on public.employee_documents;
create policy employee_documents_select on public.employee_documents
  for select to authenticated
  using (
    public.is_org_admin()
    or employee_id in (select public.my_employee_ids())
  );

drop policy if exists employee_documents_write on public.employee_documents;
create policy employee_documents_write on public.employee_documents
  for all to authenticated
  using (public.is_org_admin() and public.same_org(organization_id))
  with check (public.is_org_admin() and public.same_org(organization_id));

select public.add_org_isolation('employee_documents');

grant select, insert, update, delete on public.employee_documents to authenticated;

-- Clients cannot read emergency_contact via a dedicated view for portal staff
create or replace view public.client_visible_staff as
select
  e.id,
  e.organization_id,
  e.site_id,
  e.employee_code,
  e.designation,
  e.job_title,
  e.department,
  e.employment_status,
  e.profile_id
from public.employees e
where e.employment_status = 'active';

grant select on public.client_visible_staff to authenticated;
