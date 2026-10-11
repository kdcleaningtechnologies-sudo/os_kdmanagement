-- Keep only kdfacilitiesmanagementservices@gmail.com as a login.
-- Sites, clients, and organization records stay. Demo / extra accounts are removed.
-- Paste in the Supabase SQL editor. Safe to re-run.

do $$
declare
  v_keep uuid;
  v_removed int := 0;
begin
  select u.id
    into v_keep
  from auth.users u
  where lower(u.email) = 'kdfacilitiesmanagementservices@gmail.com'
  limit 1;

  if v_keep is null then
    raise exception 'Admin login kdfacilitiesmanagementservices@gmail.com was not found. Nothing was deleted.';
  end if;

  update public.profiles
  set role = 'super_admin',
      access_status = 'active',
      organization_id = coalesce(organization_id, '00000000-0000-4000-8000-000000000001'),
      email = coalesce(email, 'kdfacilitiesmanagementservices@gmail.com')
  where id = v_keep;

  update public.clients
  set profile_id = null
  where profile_id is distinct from v_keep;

  update public.employees
  set supervisor_id = null
  where supervisor_id is not null
    and (profile_id is distinct from v_keep or profile_id is null);

  update public.sites
  set supervisor_id = null
  where supervisor_id in (
    select e.id from public.employees e
    where e.profile_id is distinct from v_keep or e.profile_id is null
  );

  update public.profiles
  set reviewed_by = null
  where reviewed_by is distinct from v_keep;

  delete from public.notifications
  where profile_id is distinct from v_keep;

  delete from public.employees
  where profile_id is distinct from v_keep or profile_id is null;

  delete from auth.identities
  where user_id is distinct from v_keep;

  delete from auth.users
  where id is distinct from v_keep;

  get diagnostics v_removed = row_count;

  raise notice 'Kept admin %. Removed % other auth users.', v_keep, v_removed;
end;
$$;
