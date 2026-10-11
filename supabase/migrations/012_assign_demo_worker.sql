-- Assign Anita More (worker@example.com) to KD Demo Site - Pune so check-in can be tested.
-- Safe to re-run. Also lets org admins create employee rows from the admin portal.

drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees
  for insert to authenticated
  with check (public.is_super_admin() or public.is_org_admin());

do $$
declare
  v_org uuid := '00000000-0000-4000-8000-000000000001';
  v_site uuid;
  v_profile uuid;
  v_emp uuid;
  v_shift uuid;
begin
  select s.id into v_site
  from public.sites s
  where s.name = 'KD Demo Site - Pune'
     or s.organization_id = v_org
  order by case when s.name = 'KD Demo Site - Pune' then 0 else 1 end, s.created_at
  limit 1;

  if v_site is null then
    raise exception 'No site found. Create KD Demo Site - Pune first.';
  end if;

  select p.id into v_profile
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = 'worker@example.com'
  limit 1;

  if v_profile is null then
    select id into v_profile
    from public.profiles
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0005';
  end if;

  if v_profile is null then
    raise exception 'worker@example.com is missing. Run 003_fix_demo_logins.sql, then re-run this file.';
  end if;

  update public.profiles
  set organization_id = coalesce(organization_id, v_org)
  where id = v_profile;

  select e.id into v_emp
  from public.employees e
  where e.profile_id = v_profile
  order by e.created_at
  limit 1;

  v_emp := coalesce(v_emp, '44444444-4444-4444-8444-444444444006');

  insert into public.employees (
    id, profile_id, site_id, employee_code, designation, job_title, department,
    joining_date, documents, organization_id, employment_status
  ) values (
    v_emp,
    v_profile,
    v_site,
    'KD-WK-301',
    'worker',
    'Housekeeping Staff',
    'Housekeeping',
    '2024-05-12',
    '[]'::jsonb,
    v_org,
    'active'
  )
  on conflict (id) do update
    set profile_id = excluded.profile_id,
        site_id = excluded.site_id,
        employee_code = coalesce(public.employees.employee_code, excluded.employee_code),
        designation = 'worker',
        job_title = coalesce(public.employees.job_title, excluded.job_title),
        department = coalesce(public.employees.department, excluded.department),
        organization_id = excluded.organization_id,
        employment_status = 'active';

  update public.employees
  set site_id = v_site,
      organization_id = coalesce(organization_id, v_org),
      employment_status = 'active'
  where profile_id = v_profile;

  select sh.id into v_shift
  from public.shifts sh
  where sh.organization_id = v_org
     or sh.site_id = v_site
     or sh.site_id is null
  order by case when sh.kind = 'morning' then 0 else 1 end, sh.created_at
  limit 1;

  if v_shift is not null then
    insert into public.rosters (organization_id, employee_id, shift_id, site_id, weekday, status)
    select v_org, e.id, v_shift, v_site, null, 'active'
    from public.employees e
    where e.profile_id = v_profile
      and not exists (
        select 1 from public.rosters r
        where r.employee_id = e.id and r.status = 'active'
      );
  end if;
end $$;
