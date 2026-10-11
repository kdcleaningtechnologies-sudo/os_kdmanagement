-- Phase 3: shifts, roster, attendance geofence fields
-- Run after 005_phase2_directory.sql

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  name text not null,
  kind text not null default 'custom' check (kind in ('morning', 'afternoon', 'evening', 'night', 'custom')),
  start_time time not null,
  end_time time not null,
  grace_minutes integer not null default 15,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now()
);

create table if not exists public.rosters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  weekday smallint check (weekday is null or (weekday >= 0 and weekday <= 6)),
  effective_from date,
  effective_to date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now()
);

alter table public.attendance add column if not exists shift_id uuid references public.shifts(id) on delete set null;
alter table public.attendance add column if not exists location_verified boolean default false;
alter table public.attendance add column if not exists check_out_lat double precision;
alter table public.attendance add column if not exists check_out_lng double precision;

create index if not exists shifts_organization_id_idx on public.shifts (organization_id);
create index if not exists shifts_site_id_idx on public.shifts (site_id);
create index if not exists rosters_organization_id_idx on public.rosters (organization_id);
create index if not exists rosters_employee_id_idx on public.rosters (employee_id);
create index if not exists rosters_shift_id_idx on public.rosters (shift_id);
create index if not exists attendance_shift_id_idx on public.attendance (shift_id);

alter table public.shifts enable row level security;
alter table public.rosters enable row level security;

drop trigger if exists set_organization_id on public.shifts;
create trigger set_organization_id before insert on public.shifts
  for each row execute function public.set_organization_id();

drop trigger if exists set_organization_id on public.rosters;
create trigger set_organization_id before insert on public.rosters
  for each row execute function public.set_organization_id();

drop policy if exists shifts_select on public.shifts;
create policy shifts_select on public.shifts
  for select to authenticated
  using (public.same_org(organization_id));

drop policy if exists shifts_write on public.shifts;
create policy shifts_write on public.shifts
  for all to authenticated
  using (public.is_org_admin() and public.same_org(organization_id))
  with check (public.is_org_admin() and public.same_org(organization_id));

drop policy if exists rosters_select on public.rosters;
create policy rosters_select on public.rosters
  for select to authenticated
  using (
    public.same_org(organization_id)
    and (
      public.is_org_admin()
      or employee_id in (select public.my_employee_ids())
      or site_id in (select public.managed_site_ids())
    )
  );

drop policy if exists rosters_write on public.rosters;
create policy rosters_write on public.rosters
  for all to authenticated
  using (
    public.same_org(organization_id)
    and (public.is_org_admin() or site_id in (select public.managed_site_ids()))
  )
  with check (
    public.same_org(organization_id)
    and (public.is_org_admin() or site_id in (select public.managed_site_ids()))
  );

select public.add_org_isolation('shifts');
select public.add_org_isolation('rosters');

grant select, insert, update, delete on public.shifts to authenticated;
grant select, insert, update, delete on public.rosters to authenticated;

-- Default KD shifts + roster existing active staff onto Morning
insert into public.shifts (id, organization_id, name, kind, start_time, end_time, grace_minutes)
values
  ('dddddddd-1111-4111-8111-000000000001', '00000000-0000-4000-8000-000000000001', 'Morning', 'morning', '07:00', '15:00', 15),
  ('dddddddd-1111-4111-8111-000000000002', '00000000-0000-4000-8000-000000000001', 'Afternoon', 'afternoon', '14:00', '22:00', 15),
  ('dddddddd-1111-4111-8111-000000000003', '00000000-0000-4000-8000-000000000001', 'Evening', 'evening', '16:00', '00:00', 15),
  ('dddddddd-1111-4111-8111-000000000004', '00000000-0000-4000-8000-000000000001', 'Night', 'night', '22:00', '06:00', 20)
on conflict (id) do update
  set name = excluded.name,
      start_time = excluded.start_time,
      end_time = excluded.end_time;

insert into public.rosters (organization_id, employee_id, shift_id, site_id, weekday, status)
select
  e.organization_id,
  e.id,
  'dddddddd-1111-4111-8111-000000000001',
  e.site_id,
  null,
  'active'
from public.employees e
where e.employment_status = 'active'
  and e.designation in ('worker', 'security_guard')
  and not exists (
    select 1 from public.rosters r
    where r.employee_id = e.id and r.status = 'active'
  );
