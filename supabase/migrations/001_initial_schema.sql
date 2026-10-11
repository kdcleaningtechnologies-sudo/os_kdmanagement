-- KD FacilityOS
-- Full schema, helper functions, RLS policies, storage buckets, and notification triggers.
-- Run this file in the Supabase SQL Editor (or via the CLI) on a fresh project.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('super_admin', 'client', 'supervisor', 'worker')),
  phone text,
  photo_url text,
  created_at timestamptz default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  business_name text not null,
  contact_email text,
  contact_phone text,
  created_at timestamptz default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  site_type text check (site_type in ('residential', 'commercial', 'industrial')),
  area_sqft numeric,
  created_at timestamptz default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  employee_code text unique,
  designation text check (designation in ('worker', 'supervisor')),
  joining_date date,
  documents jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  status text check (status in ('present', 'absent', 'late')),
  created_at timestamptz default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade,
  assigned_to uuid references public.employees(id) on delete set null,
  description text,
  checklist jsonb default '[]'::jsonb,
  due_date date,
  status text check (status in ('pending', 'completed')) default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.inspection_reports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade,
  supervisor_id uuid references public.employees(id) on delete set null,
  photo_url text,
  ai_score numeric,
  ai_feedback jsonb,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  description text,
  status text check (status in ('open', 'in_progress', 'resolved')) default 'open',
  raised_at timestamptz default now(),
  resolved_at timestamptz
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  from_date date,
  to_date date,
  reason text,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  start_date date,
  end_date date,
  sla_terms text,
  billing_type text check (billing_type in ('per_sqft', 'per_head', 'fixed')),
  rate numeric,
  created_at timestamptz default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  period text,
  amount numeric,
  status text check (status in ('draft', 'sent', 'paid')) default 'draft',
  created_at timestamptz default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text,
  body text,
  target_role text,
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  message text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists clients_profile_id_idx on public.clients (profile_id);
create index if not exists clients_company_id_idx on public.clients (company_id);
create index if not exists sites_client_id_idx on public.sites (client_id);
create index if not exists employees_profile_id_idx on public.employees (profile_id);
create index if not exists employees_site_id_idx on public.employees (site_id);
create index if not exists attendance_employee_id_idx on public.attendance (employee_id);
create index if not exists attendance_site_id_idx on public.attendance (site_id);
create index if not exists attendance_check_in_time_idx on public.attendance (check_in_time);
create index if not exists tasks_site_id_idx on public.tasks (site_id);
create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);
create index if not exists inspection_reports_site_id_idx on public.inspection_reports (site_id);
create index if not exists complaints_client_id_idx on public.complaints (client_id);
create index if not exists complaints_site_id_idx on public.complaints (site_id);
create index if not exists leave_requests_employee_id_idx on public.leave_requests (employee_id);
create index if not exists contracts_client_id_idx on public.contracts (client_id);
create index if not exists invoices_client_id_idx on public.invoices (client_id);
create index if not exists notifications_profile_id_idx on public.notifications (profile_id);
create index if not exists notifications_is_read_idx on public.notifications (profile_id, is_read);

-- ---------------------------------------------------------------------------
-- Auto-create a profile when a new auth user is created.
-- Pass role / full_name / phone via raw_user_meta_data.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'user'), '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'worker'),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helper functions (SECURITY DEFINER to avoid policy recursion)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
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

create or replace function public.my_client_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.clients c
  where c.profile_id = auth.uid();
$$;

create or replace function public.my_employee_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id
  from public.employees e
  where e.profile_id = auth.uid();
$$;

create or replace function public.managed_site_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.site_id
  from public.employees e
  where e.profile_id = auth.uid()
    and e.designation = 'supervisor'
    and e.site_id is not null;
$$;

create or replace function public.my_site_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.sites s
  where s.client_id in (select public.my_client_ids())
  union
  select e.site_id
  from public.employees e
  where e.profile_id = auth.uid()
    and e.site_id is not null;
$$;

create or replace function public.visible_profile_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid()
  union
  select e.profile_id
  from public.employees e
  where e.profile_id is not null
    and e.site_id in (select public.my_site_ids());
$$;

create or replace function public.site_client_id(p_site_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.client_id from public.sites s where s.id = p_site_id;
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.clients enable row level security;
alter table public.sites enable row level security;
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.tasks enable row level security;
alter table public.inspection_reports enable row level security;
alter table public.complaints enable row level security;
alter table public.leave_requests enable row level security;
alter table public.contracts enable row level security;
alter table public.invoices enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    public.is_super_admin()
    or id in (select public.visible_profile_ids())
  );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (
    public.is_super_admin()
    or id = auth.uid()
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (public.is_super_admin() or id = auth.uid())
  with check (
    public.is_super_admin()
    or (id = auth.uid() and role = public.current_user_role())
  );

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select to authenticated
  using (
    public.is_super_admin()
    or id in (
      select c.company_id from public.clients c
      where c.profile_id = auth.uid() and c.company_id is not null
    )
  );

drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists companies_delete on public.companies;
create policy companies_delete on public.companies
  for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
  for select to authenticated
  using (
    public.is_super_admin()
    or id in (select public.my_client_ids())
    or id in (
      select s.client_id
      from public.sites s
      where s.id in (select public.my_site_ids())
        and s.client_id is not null
    )
  );

drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients
  for update to authenticated
  using (
    public.is_super_admin()
    or id in (select public.my_client_ids())
  )
  with check (
    public.is_super_admin()
    or id in (select public.my_client_ids())
  );

drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients
  for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- sites
-- ---------------------------------------------------------------------------
drop policy if exists sites_select on public.sites;
create policy sites_select on public.sites
  for select to authenticated
  using (
    public.is_super_admin()
    or id in (select public.my_site_ids())
  );

drop policy if exists sites_insert on public.sites;
create policy sites_insert on public.sites
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists sites_update on public.sites;
create policy sites_update on public.sites
  for update to authenticated
  using (
    public.is_super_admin()
    or id in (select public.managed_site_ids())
  )
  with check (
    public.is_super_admin()
    or id in (select public.managed_site_ids())
  );

drop policy if exists sites_delete on public.sites;
create policy sites_delete on public.sites
  for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees
  for select to authenticated
  using (
    public.is_super_admin()
    or profile_id = auth.uid()
    or site_id in (select public.my_site_ids())
  );

drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees
  for update to authenticated
  using (
    public.is_super_admin()
    or site_id in (select public.managed_site_ids())
    or id in (select public.my_employee_ids())
  )
  with check (
    public.is_super_admin()
    or site_id in (select public.managed_site_ids())
    or id in (select public.my_employee_ids())
  );

drop policy if exists employees_delete on public.employees;
create policy employees_delete on public.employees
  for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------------
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select to authenticated
  using (
    public.is_super_admin()
    or site_id in (select public.my_site_ids())
    or employee_id in (select public.my_employee_ids())
  );

drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance
  for insert to authenticated
  with check (
    public.is_super_admin()
    or site_id in (select public.managed_site_ids())
    or employee_id in (select public.my_employee_ids())
  );

drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance
  for update to authenticated
  using (
    public.is_super_admin()
    or site_id in (select public.managed_site_ids())
    or employee_id in (select public.my_employee_ids())
  )
  with check (
    public.is_super_admin()
    or site_id in (select public.managed_site_ids())
    or employee_id in (select public.my_employee_ids())
  );

drop policy if exists attendance_delete on public.attendance;
create policy attendance_delete on public.attendance
  for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    public.is_super_admin()
    or site_id in (select public.my_site_ids())
    or assigned_to in (select public.my_employee_ids())
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    public.is_super_admin()
    or site_id in (select public.managed_site_ids())
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    public.is_super_admin()
    or site_id in (select public.managed_site_ids())
    or assigned_to in (select public.my_employee_ids())
  )
  with check (
    public.is_super_admin()
    or site_id in (select public.managed_site_ids())
    or assigned_to in (select public.my_employee_ids())
  );

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (
    public.is_super_admin()
    or site_id in (select public.managed_site_ids())
  );

-- ---------------------------------------------------------------------------
-- inspection_reports
-- ---------------------------------------------------------------------------
drop policy if exists inspection_reports_select on public.inspection_reports;
create policy inspection_reports_select on public.inspection_reports
  for select to authenticated
  using (
    public.is_super_admin()
    or site_id in (select public.my_site_ids())
  );

drop policy if exists inspection_reports_insert on public.inspection_reports;
create policy inspection_reports_insert on public.inspection_reports
  for insert to authenticated
  with check (
    public.is_super_admin()
    or site_id in (select public.managed_site_ids())
  );

drop policy if exists inspection_reports_update on public.inspection_reports;
create policy inspection_reports_update on public.inspection_reports
  for update to authenticated
  using (
    public.is_super_admin()
    or site_id in (select public.managed_site_ids())
  )
  with check (
    public.is_super_admin()
    or site_id in (select public.managed_site_ids())
  );

drop policy if exists inspection_reports_delete on public.inspection_reports;
create policy inspection_reports_delete on public.inspection_reports
  for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- complaints
-- ---------------------------------------------------------------------------
drop policy if exists complaints_select on public.complaints;
create policy complaints_select on public.complaints
  for select to authenticated
  using (
    public.is_super_admin()
    or client_id in (select public.my_client_ids())
    or site_id in (select public.my_site_ids())
  );

drop policy if exists complaints_insert on public.complaints;
create policy complaints_insert on public.complaints
  for insert to authenticated
  with check (
    public.is_super_admin()
    or client_id in (select public.my_client_ids())
    or site_id in (select public.managed_site_ids())
  );

drop policy if exists complaints_update on public.complaints;
create policy complaints_update on public.complaints
  for update to authenticated
  using (
    public.is_super_admin()
    or client_id in (select public.my_client_ids())
    or site_id in (select public.managed_site_ids())
  )
  with check (
    public.is_super_admin()
    or client_id in (select public.my_client_ids())
    or site_id in (select public.managed_site_ids())
  );

drop policy if exists complaints_delete on public.complaints;
create policy complaints_delete on public.complaints
  for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- leave_requests
-- ---------------------------------------------------------------------------
drop policy if exists leave_requests_select on public.leave_requests;
create policy leave_requests_select on public.leave_requests
  for select to authenticated
  using (
    public.is_super_admin()
    or employee_id in (select public.my_employee_ids())
    or employee_id in (
      select e.id from public.employees e
      where e.site_id in (select public.managed_site_ids())
    )
  );

drop policy if exists leave_requests_insert on public.leave_requests;
create policy leave_requests_insert on public.leave_requests
  for insert to authenticated
  with check (
    public.is_super_admin()
    or employee_id in (select public.my_employee_ids())
  );

drop policy if exists leave_requests_update on public.leave_requests;
create policy leave_requests_update on public.leave_requests
  for update to authenticated
  using (
    public.is_super_admin()
    or employee_id in (
      select e.id from public.employees e
      where e.site_id in (select public.managed_site_ids())
    )
    or employee_id in (select public.my_employee_ids())
  )
  with check (
    public.is_super_admin()
    or employee_id in (
      select e.id from public.employees e
      where e.site_id in (select public.managed_site_ids())
    )
    or employee_id in (select public.my_employee_ids())
  );

drop policy if exists leave_requests_delete on public.leave_requests;
create policy leave_requests_delete on public.leave_requests
  for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- contracts
-- ---------------------------------------------------------------------------
drop policy if exists contracts_select on public.contracts;
create policy contracts_select on public.contracts
  for select to authenticated
  using (
    public.is_super_admin()
    or client_id in (select public.my_client_ids())
  );

drop policy if exists contracts_insert on public.contracts;
create policy contracts_insert on public.contracts
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists contracts_update on public.contracts;
create policy contracts_update on public.contracts
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists contracts_delete on public.contracts;
create policy contracts_delete on public.contracts
  for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select to authenticated
  using (
    public.is_super_admin()
    or client_id in (select public.my_client_ids())
  );

drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices
  for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------------
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated
  using (
    public.is_super_admin()
    or target_role is null
    or target_role = 'all'
    or target_role = public.current_user_role()
  );

drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements
  for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    public.is_super_admin()
    or profile_id = auth.uid()
  );

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.current_user_role() in ('supervisor', 'client', 'worker')
  );

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (public.is_super_admin() or profile_id = auth.uid())
  with check (public.is_super_admin() or profile_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete to authenticated
  using (public.is_super_admin() or profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Notify super_admins on new complaints and leave requests
-- ---------------------------------------------------------------------------
create or replace function public.notify_super_admins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  msg text;
begin
  if tg_table_name = 'complaints' then
    msg := 'New complaint: ' || left(coalesce(new.description, 'No details'), 120);
  elsif tg_table_name = 'leave_requests' then
    msg := 'New leave request pending approval';
  else
    msg := 'New operational alert';
  end if;

  insert into public.notifications (profile_id, message)
  select id, msg from public.profiles where role = 'super_admin';

  return new;
end;
$$;

drop trigger if exists complaints_notify_admins on public.complaints;
create trigger complaints_notify_admins
  after insert on public.complaints
  for each row execute function public.notify_super_admins();

drop trigger if exists leave_requests_notify_admins on public.leave_requests;
create trigger leave_requests_notify_admins
  after insert on public.leave_requests
  for each row execute function public.notify_super_admins();

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'inspection-photos',
    'inspection-photos',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  ),
  (
    'documents',
    'documents',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- inspection-photos: public read, authenticated write
drop policy if exists inspection_photos_public_read on storage.objects;
create policy inspection_photos_public_read on storage.objects
  for select
  using (bucket_id = 'inspection-photos');

drop policy if exists inspection_photos_auth_insert on storage.objects;
create policy inspection_photos_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inspection-photos');

drop policy if exists inspection_photos_auth_update on storage.objects;
create policy inspection_photos_auth_update on storage.objects
  for update to authenticated
  using (bucket_id = 'inspection-photos')
  with check (bucket_id = 'inspection-photos');

drop policy if exists inspection_photos_auth_delete on storage.objects;
create policy inspection_photos_auth_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'inspection-photos'
    and (public.is_super_admin() or owner = auth.uid())
  );

-- documents: private. Path convention: {employee_id}/{filename}
drop policy if exists documents_select on storage.objects;
create policy documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or (storage.foldername(name))[1] in (
        select e.id::text from public.employees e where e.profile_id = auth.uid()
      )
    )
  );

drop policy if exists documents_insert on storage.objects;
create policy documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or (storage.foldername(name))[1] in (
        select e.id::text from public.employees e where e.profile_id = auth.uid()
      )
    )
  );

drop policy if exists documents_update on storage.objects;
create policy documents_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or (storage.foldername(name))[1] in (
        select e.id::text from public.employees e where e.profile_id = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or (storage.foldername(name))[1] in (
        select e.id::text from public.employees e where e.profile_id = auth.uid()
      )
    )
  );

drop policy if exists documents_delete on storage.objects;
create policy documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or (storage.foldername(name))[1] in (
        select e.id::text from public.employees e where e.profile_id = auth.uid()
      )
    )
  );
