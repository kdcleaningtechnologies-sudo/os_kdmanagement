-- Phase 8: security checkpoints, patrols, incidents, visitors + guard portal
-- Run after 009_phase6_monthly_reports.sql
-- Demo guard login uses seed_demo_user from 003_fix_demo_logins.sql

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.can_read_security_site(p_site uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_admin()
    or p_site in (select public.managed_site_ids())
    or p_site in (select public.my_site_ids());
$$;

create or replace function public.can_write_security_site(p_site uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_admin()
    or p_site in (select public.managed_site_ids())
    or p_site in (
      select e.site_id
      from public.employees e
      where e.profile_id = auth.uid()
        and e.site_id is not null
    );
$$;

grant execute on function public.can_read_security_site(uuid) to authenticated;
grant execute on function public.can_write_security_site(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.security_checkpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null,
  location_hint text,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now()
);

create table if not exists public.security_patrols (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  guard_id uuid references public.employees(id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'missed')),
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.security_patrol_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  patrol_id uuid not null references public.security_patrols(id) on delete cascade,
  checkpoint_id uuid not null references public.security_checkpoints(id) on delete cascade,
  checked_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'verified', 'skipped', 'missed')),
  latitude numeric,
  longitude numeric,
  notes text,
  created_at timestamptz default now(),
  unique (patrol_id, checkpoint_id)
);

create table if not exists public.security_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  guard_id uuid references public.employees(id) on delete set null,
  incident_type text not null default 'other' check (incident_type in (
    'trespass', 'theft', 'fire', 'medical', 'vandalism', 'disturbance', 'other'
  )),
  description text,
  photo_url text,
  photos jsonb not null default '[]'::jsonb,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'closed')),
  created_at timestamptz default now()
);

create table if not exists public.visitors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  visitor_name text not null,
  phone text,
  purpose text,
  host text,
  vehicle_number text,
  entry_time timestamptz not null default now(),
  exit_time timestamptz,
  logged_by uuid references public.employees(id) on delete set null,
  status text not null default 'on_site' check (status in ('on_site', 'exited')),
  created_at timestamptz default now()
);

create index if not exists security_checkpoints_site_id_idx on public.security_checkpoints (site_id);
create index if not exists security_checkpoints_organization_id_idx on public.security_checkpoints (organization_id);
create index if not exists security_patrols_site_id_idx on public.security_patrols (site_id);
create index if not exists security_patrols_guard_id_idx on public.security_patrols (guard_id);
create index if not exists security_patrols_organization_id_idx on public.security_patrols (organization_id);
create index if not exists security_patrols_created_at_idx on public.security_patrols (created_at);
create index if not exists security_patrol_checks_patrol_id_idx on public.security_patrol_checks (patrol_id);
create index if not exists security_incidents_site_id_idx on public.security_incidents (site_id);
create index if not exists security_incidents_organization_id_idx on public.security_incidents (organization_id);
create index if not exists security_incidents_created_at_idx on public.security_incidents (created_at);
create index if not exists visitors_site_id_idx on public.visitors (site_id);
create index if not exists visitors_organization_id_idx on public.visitors (organization_id);
create index if not exists visitors_status_idx on public.visitors (status);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.security_checkpoints enable row level security;
alter table public.security_patrols enable row level security;
alter table public.security_patrol_checks enable row level security;
alter table public.security_incidents enable row level security;
alter table public.visitors enable row level security;

drop trigger if exists set_organization_id on public.security_checkpoints;
create trigger set_organization_id before insert on public.security_checkpoints
  for each row execute function public.set_organization_id();

drop trigger if exists set_organization_id on public.security_patrols;
create trigger set_organization_id before insert on public.security_patrols
  for each row execute function public.set_organization_id();

drop trigger if exists set_organization_id on public.security_patrol_checks;
create trigger set_organization_id before insert on public.security_patrol_checks
  for each row execute function public.set_organization_id();

drop trigger if exists set_organization_id on public.security_incidents;
create trigger set_organization_id before insert on public.security_incidents
  for each row execute function public.set_organization_id();

drop trigger if exists set_organization_id on public.visitors;
create trigger set_organization_id before insert on public.visitors
  for each row execute function public.set_organization_id();

drop policy if exists security_checkpoints_select on public.security_checkpoints;
create policy security_checkpoints_select on public.security_checkpoints
  for select to authenticated
  using (public.can_read_security_site(site_id));

drop policy if exists security_checkpoints_write on public.security_checkpoints;
create policy security_checkpoints_write on public.security_checkpoints
  for all to authenticated
  using (public.can_write_security_site(site_id))
  with check (public.can_write_security_site(site_id));

drop policy if exists security_patrols_select on public.security_patrols;
create policy security_patrols_select on public.security_patrols
  for select to authenticated
  using (public.can_read_security_site(site_id));

drop policy if exists security_patrols_write on public.security_patrols;
create policy security_patrols_write on public.security_patrols
  for all to authenticated
  using (public.can_write_security_site(site_id))
  with check (public.can_write_security_site(site_id));

drop policy if exists security_patrol_checks_select on public.security_patrol_checks;
create policy security_patrol_checks_select on public.security_patrol_checks
  for select to authenticated
  using (
    exists (
      select 1 from public.security_patrols p
      where p.id = patrol_id and public.can_read_security_site(p.site_id)
    )
  );

drop policy if exists security_patrol_checks_write on public.security_patrol_checks;
create policy security_patrol_checks_write on public.security_patrol_checks
  for all to authenticated
  using (
    exists (
      select 1 from public.security_patrols p
      where p.id = patrol_id and public.can_write_security_site(p.site_id)
    )
  )
  with check (
    exists (
      select 1 from public.security_patrols p
      where p.id = patrol_id and public.can_write_security_site(p.site_id)
    )
  );

drop policy if exists security_incidents_select on public.security_incidents;
create policy security_incidents_select on public.security_incidents
  for select to authenticated
  using (public.can_read_security_site(site_id));

drop policy if exists security_incidents_write on public.security_incidents;
create policy security_incidents_write on public.security_incidents
  for all to authenticated
  using (public.can_write_security_site(site_id))
  with check (public.can_write_security_site(site_id));

drop policy if exists visitors_select on public.visitors;
create policy visitors_select on public.visitors
  for select to authenticated
  using (public.can_read_security_site(site_id));

drop policy if exists visitors_write on public.visitors;
create policy visitors_write on public.visitors
  for all to authenticated
  using (public.can_write_security_site(site_id))
  with check (public.can_write_security_site(site_id));

select public.add_org_isolation('security_checkpoints');
select public.add_org_isolation('security_patrols');
select public.add_org_isolation('security_patrol_checks');
select public.add_org_isolation('security_incidents');
select public.add_org_isolation('visitors');

grant select, insert, update, delete on public.security_checkpoints to authenticated;
grant select, insert, update, delete on public.security_patrols to authenticated;
grant select, insert, update, delete on public.security_patrol_checks to authenticated;
grant select, insert, update, delete on public.security_incidents to authenticated;
grant select, insert, update, delete on public.visitors to authenticated;

-- ---------------------------------------------------------------------------
-- Incident photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'incident-photos',
  'incident-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

drop policy if exists incident_photos_public_read on storage.objects;
create policy incident_photos_public_read on storage.objects
  for select to public
  using (bucket_id = 'incident-photos');

drop policy if exists incident_photos_auth_insert on storage.objects;
create policy incident_photos_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'incident-photos');

-- Make sure later-phase columns exist even if an earlier seed was skipped
alter table public.clients add column if not exists status text;
alter table public.sites add column if not exists city text;
alter table public.sites add column if not exists status text;
alter table public.employees add column if not exists job_title text;
alter table public.employees add column if not exists department text;
alter table public.employees add column if not exists employment_status text;

alter table public.employees drop constraint if exists employees_designation_check;
alter table public.employees
  add constraint employees_designation_check
  check (designation in ('worker', 'supervisor', 'security_guard'));

-- ---------------------------------------------------------------------------
-- Demo guard + sample rounds
-- Seed errors are caught so tables/RLS above still commit.
-- ---------------------------------------------------------------------------
do $$
declare
  v_org uuid;
  v_guard uuid;
  v_emp uuid := '44444444-4444-4444-8444-444444444009';
  v_site uuid;
  v_site_b uuid;
  v_shift uuid;
  v_client uuid;
begin
  select id into v_org from public.organizations order by created_at limit 1;
  if v_org is null then
    insert into public.organizations (id, name, email, tagline, status)
    values (
      '00000000-0000-4000-8000-000000000001',
      'KD Facilities Management Services',
      'kdfacilitiesmanagementservices@gmail.com',
      'Cleaner Spaces | Safer Spaces | Better Living',
      'active'
    )
    on conflict (id) do nothing;
    v_org := '00000000-0000-4000-8000-000000000001';
  end if;

  select s.id into v_site from public.sites s order by s.created_at limit 1;

  if v_site is null then
    select c.id into v_client from public.clients c order by c.created_at limit 1;
    if v_client is null then
      v_client := '22222222-2222-4222-8222-222222222090';
      insert into public.clients (id, business_name, contact_email, organization_id)
      values (v_client, 'KD Demo Client', 'demo.client@example.com', v_org)
      on conflict (id) do update set organization_id = excluded.organization_id;
      update public.clients set status = 'active' where id = v_client and status is null;
    end if;

    v_site := '33333333-3333-4333-8333-333333333090';
    insert into public.sites (id, client_id, name, address, latitude, longitude, site_type, organization_id)
    values (
      v_site,
      v_client,
      'KD Demo Site - Pune',
      'Koregaon Park, Pune',
      18.5362,
      73.8939,
      'commercial',
      v_org
    )
    on conflict (id) do update set organization_id = excluded.organization_id;
    update public.sites set city = coalesce(city, 'Pune'), status = coalesce(status, 'active') where id = v_site;
  end if;

  select s.id into v_site_b from public.sites s where s.id <> v_site order by s.created_at limit 1;
  v_site_b := coalesce(v_site_b, v_site);

  select sh.id into v_shift
  from public.shifts sh
  order by case when sh.kind = 'night' then 0 else 1 end, sh.created_at
  limit 1;

  if to_regprocedure('public.seed_demo_user(uuid, text, text, text, text, text, text)') is null then
    raise exception 'seed_demo_user() is missing. Run 003_fix_demo_logins.sql once, then re-run this file.';
  end if;

  v_guard := public.seed_demo_user(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0008',
    'guard@example.com',
    'FacilityOS@2026',
    'Nitin Kale',
    'security_guard',
    '+91 98765 44011',
    'https://ui-avatars.com/api/?name=Nitin+Kale&background=124440&color=fff'
  );

  update public.profiles set organization_id = v_org where id = v_guard;

  insert into public.employees (
    id, profile_id, site_id, employee_code, designation, joining_date, documents, organization_id
  ) values (
    v_emp, v_guard, v_site, 'KD-SEC-501', 'security_guard', '2025-02-01', '[]'::jsonb, v_org
  )
  on conflict (id) do update
    set profile_id = excluded.profile_id,
        site_id = excluded.site_id,
        designation = excluded.designation,
        organization_id = excluded.organization_id;

  update public.employees
  set job_title = coalesce(job_title, 'Security Guard'),
      department = coalesce(department, 'Security'),
      employment_status = coalesce(employment_status, 'active')
  where id = v_emp;

  if v_shift is not null then
    insert into public.rosters (organization_id, employee_id, shift_id, site_id, weekday, status)
    select v_org, v_emp, v_shift, v_site, null, 'active'
    where not exists (
      select 1 from public.rosters r
      where r.employee_id = v_emp and r.status = 'active'
    );
  end if;

  insert into public.security_checkpoints (id, organization_id, site_id, name, location_hint, sort_order) values
    ('bbbbbbbb-1111-4111-8111-000000000001', v_org, v_site, 'Reception', 'Ground floor lobby desk', 1),
    ('bbbbbbbb-1111-4111-8111-000000000002', v_org, v_site, 'Basement parking', 'Ramp and bike bay', 2),
    ('bbbbbbbb-1111-4111-8111-000000000003', v_org, v_site, 'Server corridor', 'Level 2 restricted wing', 3),
    ('bbbbbbbb-1111-4111-8111-000000000004', v_org, v_site_b, 'Main gate', 'Primary vehicle entrance', 1),
    ('bbbbbbbb-1111-4111-8111-000000000005', v_org, v_site_b, 'Lobby L1', 'Lift bank', 2)
  on conflict (id) do update
    set site_id = excluded.site_id,
        name = excluded.name,
        location_hint = excluded.location_hint,
        sort_order = excluded.sort_order,
        organization_id = excluded.organization_id;

  insert into public.security_patrols (id, organization_id, site_id, guard_id, status, started_at, notes) values
    (
      'cccccccc-1111-4111-8111-000000000001',
      v_org, v_site, v_emp, 'in_progress', now() - interval '40 minutes', 'Evening perimeter'
    )
  on conflict (id) do update
    set site_id = excluded.site_id,
        guard_id = excluded.guard_id,
        status = excluded.status,
        started_at = excluded.started_at,
        notes = excluded.notes,
        organization_id = excluded.organization_id;

  insert into public.security_patrol_checks (id, organization_id, patrol_id, checkpoint_id, checked_at, status) values
    ('cccccccc-2222-4222-8222-000000000001', v_org, 'cccccccc-1111-4111-8111-000000000001', 'bbbbbbbb-1111-4111-8111-000000000001', now() - interval '25 minutes', 'verified'),
    ('cccccccc-2222-4222-8222-000000000002', v_org, 'cccccccc-1111-4111-8111-000000000001', 'bbbbbbbb-1111-4111-8111-000000000002', now() - interval '12 minutes', 'verified'),
    ('cccccccc-2222-4222-8222-000000000003', v_org, 'cccccccc-1111-4111-8111-000000000001', 'bbbbbbbb-1111-4111-8111-000000000003', null, 'pending')
  on conflict (patrol_id, checkpoint_id) do update
    set status = excluded.status,
        checked_at = excluded.checked_at,
        organization_id = excluded.organization_id;

  insert into public.security_incidents (id, organization_id, site_id, guard_id, incident_type, description, severity, status) values
    (
      'ffffffff-1111-4111-8111-000000000001',
      v_org, v_site_b, v_emp, 'trespass',
      'Unknown person near the service gate after 21:00. Asked to leave. No forced entry.',
      'medium', 'open'
    )
  on conflict (id) do update
    set site_id = excluded.site_id,
        description = excluded.description,
        severity = excluded.severity,
        status = excluded.status,
        organization_id = excluded.organization_id;

  insert into public.visitors (id, organization_id, site_id, visitor_name, phone, purpose, host, vehicle_number, entry_time, exit_time, logged_by, status) values
    (
      '99999999-1111-4111-8111-000000000001',
      v_org, v_site, 'Rohit Naik', '+91 98220 11011', 'HVAC vendor service', 'Facilities desk',
      'MH12 AB 4412', now() - interval '90 minutes', null, v_emp, 'on_site'
    ),
    (
      '99999999-1111-4111-8111-000000000002',
      v_org, v_site, 'Sneha Kulkarni', '+91 98810 22022', 'Client meeting', 'Reception',
      null, now() - interval '5 hours', now() - interval '3 hours', v_emp, 'exited'
    )
  on conflict (id) do update
    set site_id = excluded.site_id,
        visitor_name = excluded.visitor_name,
        status = excluded.status,
        exit_time = excluded.exit_time,
        organization_id = excluded.organization_id;
exception
  when others then
    raise notice 'Phase 8 tables are ready. Demo seed skipped: %', SQLERRM;
end $$;
