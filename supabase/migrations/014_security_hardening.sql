-- Production security hardening. Safe to re-run.
-- Paste in Supabase SQL editor after 013.

-- ---------------------------------------------------------------------------
-- Privileged roles cannot be self-assigned
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_super_admin()
       and new.role in ('super_admin', 'admin', 'operations_manager') then
      raise exception 'Privileged roles can only be assigned by a super admin';
    end if;
    return new;
  end if;

  if not public.is_super_admin() then
    new.role := old.role;
    new.organization_id := old.organization_id;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privilege on public.profiles;
create trigger protect_profile_privilege
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privilege();

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      id = auth.uid()
      and role not in ('super_admin', 'admin', 'operations_manager')
    )
  );

-- ---------------------------------------------------------------------------
-- Tenant: always stamp the caller's organization (except super_admin)
-- ---------------------------------------------------------------------------
create or replace function public.set_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_super_admin() then
    if new.organization_id is null then
      new.organization_id := public.current_organization_id();
    end if;
  else
    new.organization_id := public.current_organization_id();
  end if;
  return new;
end;
$$;

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
    'create policy %I on public.%I as restrictive for insert to authenticated with check (public.same_org(organization_id))',
    p_table || '_org_insert', p_table
  );
  execute format('drop policy if exists %I on public.%I', p_table || '_org_update', p_table);
  execute format(
    'create policy %I on public.%I as restrictive for update to authenticated using (public.same_org(organization_id)) with check (public.same_org(organization_id))',
    p_table || '_org_update', p_table
  );
  execute format('drop policy if exists %I on public.%I', p_table || '_org_delete', p_table);
  execute format(
    'create policy %I on public.%I as restrictive for delete to authenticated using (public.same_org(organization_id))',
    p_table || '_org_delete', p_table
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

-- ---------------------------------------------------------------------------
-- One attendance row per employee per calendar day (blocks bulk punches)
-- ---------------------------------------------------------------------------
do $$
begin
  create unique index if not exists attendance_employee_day_uidx
    on public.attendance (employee_id, ((timezone('Asia/Kolkata', created_at))::date));
exception
  when unique_violation then
    raise notice 'Skipped attendance unique index because duplicate punches already exist';
end;
$$;

-- ---------------------------------------------------------------------------
-- Notifications: no arbitrary profile targeting except toward org admins
-- ---------------------------------------------------------------------------
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.is_org_admin()
    or public.current_user_role() = 'supervisor'
    or profile_id in (
      select p.id from public.profiles p
      where p.role in ('super_admin', 'admin', 'operations_manager')
        and (p.organization_id = public.current_organization_id() or p.role = 'super_admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: authenticated users may only write into a site folder they can see
-- ---------------------------------------------------------------------------
create or replace function public.can_upload_site_folder(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_bucket in ('inspection-photos', 'complaint-photos', 'incident-photos')
    and (
      public.is_org_admin()
      or public.is_super_admin()
      or (storage.foldername(p_name))[1] in (select site_id::text from public.my_site_ids() as site_id)
    );
$$;

drop policy if exists inspection_photos_auth_insert on storage.objects;
create policy inspection_photos_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inspection-photos' and public.can_upload_site_folder(bucket_id, name));

drop policy if exists inspection_photos_auth_update on storage.objects;
create policy inspection_photos_auth_update on storage.objects
  for update to authenticated
  using (bucket_id = 'inspection-photos' and (public.is_org_admin() or owner = auth.uid()))
  with check (bucket_id = 'inspection-photos' and (public.is_org_admin() or owner = auth.uid()));

drop policy if exists complaint_photos_auth_insert on storage.objects;
create policy complaint_photos_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'complaint-photos' and public.can_upload_site_folder(bucket_id, name));

drop policy if exists complaint_photos_auth_update on storage.objects;
create policy complaint_photos_auth_update on storage.objects
  for update to authenticated
  using (bucket_id = 'complaint-photos' and (public.is_org_admin() or owner = auth.uid()))
  with check (bucket_id = 'complaint-photos' and (public.is_org_admin() or owner = auth.uid()));

drop policy if exists incident_photos_auth_insert on storage.objects;
create policy incident_photos_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'incident-photos' and public.can_upload_site_folder(bucket_id, name));

drop policy if exists incident_photos_auth_update on storage.objects;
create policy incident_photos_auth_update on storage.objects
  for update to authenticated
  using (bucket_id = 'incident-photos' and (public.is_org_admin() or owner = auth.uid()))
  with check (bucket_id = 'incident-photos' and (public.is_org_admin() or owner = auth.uid()));

-- Org admins (not only super_admin) manage invoices; clients still cannot write.
drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices
  for insert to authenticated
  with check (public.is_super_admin() or public.is_org_admin());

drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices
  for update to authenticated
  using (public.is_super_admin() or public.is_org_admin())
  with check (public.is_super_admin() or public.is_org_admin());

-- ---------------------------------------------------------------------------
-- Attendance: ignore client "verified" flags; freeze check-in after insert
-- ---------------------------------------------------------------------------
create or replace function public.haversine_meters(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else 6371000 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    ))
  end;
$$;

create or replace function public.enforce_attendance_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  site_lat double precision;
  site_lng double precision;
  radius integer;
  dist double precision;
  privileged boolean;
begin
  privileged := public.is_super_admin() or public.is_org_admin() or public.current_user_role() = 'supervisor';

  if not privileged then
    if new.employee_id not in (select public.my_employee_ids()) then
      raise exception 'Cannot punch attendance for another person';
    end if;
    if tg_op = 'UPDATE' then
      new.employee_id := old.employee_id;
      new.site_id := old.site_id;
      new.check_in_time := old.check_in_time;
      new.check_in_lat := old.check_in_lat;
      new.check_in_lng := old.check_in_lng;
    end if;
  end if;

  select s.latitude, s.longitude, coalesce(s.geofence_radius, 200)
    into site_lat, site_lng, radius
  from public.sites s
  where s.id = new.site_id;

  dist := public.haversine_meters(new.check_in_lat, new.check_in_lng, site_lat, site_lng);
  new.location_verified := dist is not null and dist <= radius;
  return new;
end;
$$;

drop trigger if exists enforce_attendance_integrity on public.attendance;
create trigger enforce_attendance_integrity
  before insert or update on public.attendance
  for each row execute function public.enforce_attendance_integrity();

create or replace function public.limit_child_rows()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'inspection_items' then
    if (select count(*) from public.inspection_items where inspection_id = new.inspection_id) >= 40 then
      raise exception 'Too many inspection items';
    end if;
  elsif tg_table_name = 'inspection_photos' then
    if (select count(*) from public.inspection_photos where inspection_id = new.inspection_id) >= 8 then
      raise exception 'Too many inspection photos';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists limit_inspection_items on public.inspection_items;
create trigger limit_inspection_items
  before insert on public.inspection_items
  for each row execute function public.limit_child_rows();

drop trigger if exists limit_inspection_photos on public.inspection_photos;
create trigger limit_inspection_photos
  before insert on public.inspection_photos
  for each row execute function public.limit_child_rows();

-- ---------------------------------------------------------------------------
-- Audit log for sensitive tables (no secrets)
-- ---------------------------------------------------------------------------
create or replace function public.audit_sensitive_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (organization_id, profile_id, action, module, record_table, record_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id, public.current_organization_id()),
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    tg_table_name,
    coalesce(new.id, old.id),
    jsonb_build_object('op', tg_op)
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists audit_employees on public.employees;
create trigger audit_employees
  after insert or update or delete on public.employees
  for each row execute function public.audit_sensitive_change();

drop trigger if exists audit_invoices on public.invoices;
create trigger audit_invoices
  after insert or update or delete on public.invoices
  for each row execute function public.audit_sensitive_change();

drop trigger if exists audit_sites on public.sites;
create trigger audit_sites
  after insert or update or delete on public.sites
  for each row execute function public.audit_sensitive_change();

drop trigger if exists audit_clients on public.clients;
create trigger audit_clients
  after insert or update or delete on public.clients
  for each row execute function public.audit_sensitive_change();
