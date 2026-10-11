-- Phase 1: organizations, expanded roles, tenant isolation, audit log.
-- Run after 001 (and optionally 002/003). Safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  phone text,
  email text,
  address text,
  website text,
  tagline text default 'Cleaner Spaces | Safer Spaces | Better Living',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR',
  default_geofence_meters integer not null default 200,
  updated_at timestamptz default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  module text,
  record_table text,
  record_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

insert into public.organizations (
  id, name, phone, email, address, website, tagline, status
) values (
  '00000000-0000-4000-8000-000000000001',
  'KD Facilities Management Services',
  '+91 20 0000 0000',
  'kdfacilitiesmanagementservices@gmail.com',
  'Pune, Maharashtra, India',
  'https://kdfacilityos.local',
  'Cleaner Spaces | Safer Spaces | Better Living',
  'active'
)
on conflict (id) do update
  set name = excluded.name,
      tagline = excluded.tagline,
      status = 'active',
      updated_at = now();

insert into public.organization_settings (organization_id)
values ('00000000-0000-4000-8000-000000000001')
on conflict (organization_id) do nothing;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in (
    'super_admin',
    'admin',
    'operations_manager',
    'supervisor',
    'worker',
    'security_guard',
    'client_admin',
    'client_user',
    'client'
  ));

-- ---------------------------------------------------------------------------
-- organization_id on tenant tables
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.companies add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.clients add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.sites add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.employees add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.attendance add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.tasks add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.inspection_reports add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.complaints add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.leave_requests add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.contracts add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.invoices add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.announcements add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.notifications add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

update public.profiles
set organization_id = '00000000-0000-4000-8000-000000000001'
where organization_id is null and role <> 'super_admin';

update public.companies set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.clients set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.sites set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.employees set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.attendance set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.tasks set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.inspection_reports set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.complaints set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.leave_requests set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.contracts set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.invoices set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.announcements set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.notifications set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;

-- Super admin may stay unscoped or belong to KD
update public.profiles
set organization_id = coalesce(organization_id, '00000000-0000-4000-8000-000000000001')
where role = 'super_admin';

create index if not exists profiles_organization_id_idx on public.profiles (organization_id);
create index if not exists companies_organization_id_idx on public.companies (organization_id);
create index if not exists clients_organization_id_idx on public.clients (organization_id);
create index if not exists sites_organization_id_idx on public.sites (organization_id);
create index if not exists employees_organization_id_idx on public.employees (organization_id);
create index if not exists attendance_organization_id_idx on public.attendance (organization_id);
create index if not exists tasks_organization_id_idx on public.tasks (organization_id);
create index if not exists inspection_reports_organization_id_idx on public.inspection_reports (organization_id);
create index if not exists complaints_organization_id_idx on public.complaints (organization_id);
create index if not exists leave_requests_organization_id_idx on public.leave_requests (organization_id);
create index if not exists contracts_organization_id_idx on public.contracts (organization_id);
create index if not exists invoices_organization_id_idx on public.invoices (organization_id);
create index if not exists announcements_organization_id_idx on public.announcements (organization_id);
create index if not exists notifications_organization_id_idx on public.notifications (organization_id);
create index if not exists audit_logs_organization_id_idx on public.audit_logs (organization_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at);

-- ---------------------------------------------------------------------------
-- Tenant helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('super_admin', 'admin', 'operations_manager')
  );
$$;

create or replace function public.same_org(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or (p_org is not null and p_org = public.current_organization_id());
$$;

create or replace function public.set_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_organization_id();
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'clients', 'sites', 'employees', 'attendance', 'tasks',
    'inspection_reports', 'complaints', 'leave_requests', 'contracts',
    'invoices', 'announcements', 'notifications'
  ]
  loop
    execute format('drop trigger if exists set_organization_id on public.%I', t);
    execute format(
      'create trigger set_organization_id before insert on public.%I for each row execute function public.set_organization_id()',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Restrictive tenant wall (AND with existing permissive role/site policies)
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_super_admin() or id = public.current_organization_id());

drop policy if exists organizations_insert on public.organizations;
create policy organizations_insert on public.organizations
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_super_admin() or (id = public.current_organization_id() and public.is_org_admin()))
  with check (public.is_super_admin() or (id = public.current_organization_id() and public.is_org_admin()));

drop policy if exists organizations_delete on public.organizations;
create policy organizations_delete on public.organizations
  for delete to authenticated
  using (public.is_super_admin());

drop policy if exists organization_settings_select on public.organization_settings;
create policy organization_settings_select on public.organization_settings
  for select to authenticated
  using (public.same_org(organization_id));

drop policy if exists organization_settings_write on public.organization_settings;
create policy organization_settings_write on public.organization_settings
  for all to authenticated
  using (public.is_super_admin() or (organization_id = public.current_organization_id() and public.is_org_admin()))
  with check (public.is_super_admin() or (organization_id = public.current_organization_id() and public.is_org_admin()));

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.is_org_admin() and public.same_org(organization_id));

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert to authenticated
  with check (public.same_org(organization_id) or public.is_super_admin());

create or replace function public.add_org_isolation(p_table text)
returns void
language plpgsql
as $$
begin
  execute format('drop policy if exists %I on public.%I', p_table || '_org_select', p_table);
  execute format(
    'create policy %I on public.%I as restrictive for select to authenticated using (public.same_org(organization_id))',
    p_table || '_org_select', p_table
  );
  execute format('drop policy if exists %I on public.%I', p_table || '_org_insert', p_table);
  execute format(
    'create policy %I on public.%I as restrictive for insert to authenticated with check (public.same_org(organization_id) or organization_id is null)',
    p_table || '_org_insert', p_table
  );
  execute format('drop policy if exists %I on public.%I', p_table || '_org_update', p_table);
  execute format(
    'create policy %I on public.%I as restrictive for update to authenticated using (public.same_org(organization_id)) with check (public.same_org(organization_id))',
    p_table || '_org_update', p_table
  );
end;
$$;

select public.add_org_isolation('companies');
select public.add_org_isolation('clients');
select public.add_org_isolation('sites');
select public.add_org_isolation('employees');
select public.add_org_isolation('attendance');
select public.add_org_isolation('tasks');
select public.add_org_isolation('inspection_reports');
select public.add_org_isolation('complaints');
select public.add_org_isolation('leave_requests');
select public.add_org_isolation('contracts');
select public.add_org_isolation('invoices');
select public.add_org_isolation('announcements');
select public.add_org_isolation('notifications');

-- Profiles: users see own org staff; super_admin sees all
drop policy if exists profiles_org_select on public.profiles;
create policy profiles_org_select on public.profiles
  as restrictive
  for select to authenticated
  using (
    public.is_super_admin()
    or id = auth.uid()
    or organization_id = public.current_organization_id()
  );

-- ---------------------------------------------------------------------------
-- Signup trigger: role + organization from user metadata
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_org uuid;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'worker');
  if v_role not in (
    'super_admin', 'admin', 'operations_manager', 'supervisor', 'worker',
    'security_guard', 'client_admin', 'client_user', 'client'
  ) then
    v_role := 'worker';
  end if;

  begin
    v_org := nullif(new.raw_user_meta_data->>'organization_id', '')::uuid;
  exception
    when others then
      v_org := null;
  end;

  if v_role <> 'super_admin' then
    v_org := coalesce(v_org, '00000000-0000-4000-8000-000000000001');
  end if;

  insert into public.profiles (id, full_name, role, phone, organization_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'user'), '@', 1)),
    v_role,
    new.raw_user_meta_data->>'phone',
    v_org
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit helper
-- ---------------------------------------------------------------------------
create or replace function public.write_audit(
  p_action text,
  p_module text default null,
  p_table text default null,
  p_record uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (organization_id, profile_id, action, module, record_table, record_id, metadata)
  values (public.current_organization_id(), auth.uid(), p_action, p_module, p_table, p_record, p_metadata);
end;
$$;

grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_settings to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.same_org(uuid) to authenticated;
grant execute on function public.is_org_admin() to authenticated;
grant execute on function public.write_audit(text, text, text, uuid, jsonb) to authenticated;
