-- Sign-up with admin approval. Safe to re-run.
-- New accounts stay pending until an org admin or super admin approves them.

alter table public.profiles
  add column if not exists access_status text not null default 'active';

alter table public.profiles
  drop constraint if exists profiles_access_status_check;

alter table public.profiles
  add constraint profiles_access_status_check
  check (access_status in ('pending', 'active', 'rejected'));

alter table public.profiles
  add column if not exists requested_role text;

alter table public.profiles
  add column if not exists reviewed_at timestamptz;

alter table public.profiles
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.profiles
  add column if not exists access_note text;

alter table public.profiles
  add column if not exists email text;

create index if not exists profiles_access_status_idx on public.profiles (access_status);

-- Existing people keep working.
update public.profiles
set access_status = 'active'
where access_status is null or access_status = '';

-- ---------------------------------------------------------------------------
-- Public signup trigger: never trust client role / org metadata
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested text;
  v_name text;
  v_phone text;
begin
  v_requested := coalesce(new.raw_user_meta_data->>'requested_role', new.raw_user_meta_data->>'role', 'worker');
  if v_requested not in ('worker', 'supervisor', 'security_guard', 'client') then
    v_requested := 'worker';
  end if;

  v_name := left(trim(coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'user'), '@', 1))), 80);
  if v_name = '' then
    v_name := 'New user';
  end if;
  v_phone := left(trim(coalesce(new.raw_user_meta_data->>'phone', '')), 20);
  if v_phone = '' then
    v_phone := null;
  end if;

  insert into public.profiles (id, full_name, role, phone, email, organization_id, access_status, requested_role)
  values (new.id, v_name, v_requested, v_phone, new.email, null, 'pending', v_requested)
  on conflict (id) do nothing;

  begin
    insert into public.notifications (organization_id, profile_id, message, is_read)
    select
      p.organization_id,
      p.id,
      'New access request: ' || v_name || ' (' || v_requested || ')',
      false
    from public.profiles p
    where p.role in ('super_admin', 'admin', 'operations_manager')
      and coalesce(p.access_status, 'active') = 'active'
      and p.id <> new.id
      and p.organization_id is not null;
  exception
    when others then
      null;
  end;

  return new;
end;
$$;

-- Seed helper: demo / provisioned users are already trusted and stay active.
create or replace function public.seed_demo_user(
  p_id uuid,
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_phone text default null,
  p_photo text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_id uuid;
  v_hash text;
  v_org uuid := '00000000-0000-4000-8000-000000000001';
begin
  v_hash := crypt(p_password, gen_salt('bf'));

  select u.id into v_id from auth.users u where u.id = p_id or u.email = p_email limit 1;

  if v_id is null then
    v_id := p_id;
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_id, 'authenticated', 'authenticated', p_email, v_hash, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_full_name, 'role', p_role, 'phone', p_phone),
      now(), now(), '', '', '', ''
    );
  else
    update auth.users
    set email = p_email,
        encrypted_password = v_hash,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = jsonb_build_object('full_name', p_full_name, 'role', p_role, 'phone', p_phone),
        updated_at = now()
    where id = v_id;
  end if;

  if not exists (select 1 from auth.identities i where i.user_id = v_id and i.provider = 'email') then
    begin
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_id, v_id::text,
        jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
        'email', now(), now(), now()
      );
    exception
      when others then
        null;
    end;
  end if;

  insert into public.profiles (id, full_name, role, phone, photo_url, email, organization_id, access_status, requested_role)
  values (v_id, p_full_name, p_role, p_phone, p_photo, p_email, v_org, 'active', p_role)
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = excluded.role,
        phone = excluded.phone,
        photo_url = excluded.photo_url,
        email = coalesce(public.profiles.email, excluded.email),
        organization_id = coalesce(public.profiles.organization_id, excluded.organization_id),
        access_status = 'active';

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilege + approval fields cannot be self-assigned
-- auth.uid() is null during SQL-editor provisioning, which is allowed.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_safe text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.is_super_admin() then
      v_safe := coalesce(new.requested_role, new.role, 'worker');
      if v_safe not in ('worker', 'supervisor', 'security_guard', 'client') then
        v_safe := 'worker';
      end if;
      new.role := v_safe;
      new.requested_role := v_safe;
      new.access_status := 'pending';
      new.organization_id := null;
      new.reviewed_at := null;
      new.reviewed_by := null;
    end if;
    return new;
  end if;

  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if public.is_org_admin() then
    if new.role = 'super_admin' then
      new.role := old.role;
    end if;
    if new.organization_id is not null
       and public.current_organization_id() is not null
       and new.organization_id is distinct from public.current_organization_id() then
      new.organization_id := public.current_organization_id();
    end if;
    return new;
  end if;

  new.role := old.role;
  new.organization_id := old.organization_id;
  new.access_status := old.access_status;
  new.requested_role := old.requested_role;
  new.reviewed_at := old.reviewed_at;
  new.reviewed_by := old.reviewed_by;
  new.access_note := old.access_note;
  return new;
end;
$$;

drop trigger if exists protect_profile_privilege on public.profiles;
create trigger protect_profile_privilege
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privilege();

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_org_admin()
    or id = auth.uid()
    or id in (select public.visible_profile_ids())
  );

drop policy if exists profiles_org_select on public.profiles;
create policy profiles_org_select on public.profiles
  as restrictive
  for select to authenticated
  using (
    public.is_super_admin()
    or id = auth.uid()
    or public.same_org(organization_id)
    or (
      public.is_org_admin()
      and access_status in ('pending', 'rejected')
      and organization_id is null
    )
  );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      id = auth.uid()
      and role not in ('super_admin', 'admin', 'operations_manager')
      and coalesce(access_status, 'pending') = 'pending'
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (public.is_super_admin() or public.is_org_admin() or id = auth.uid())
  with check (public.is_super_admin() or public.is_org_admin() or id = auth.uid());

-- ---------------------------------------------------------------------------
-- Admin-only review. Callers cannot approve themselves.
-- ---------------------------------------------------------------------------
create or replace function public.review_access_request(
  p_profile_id uuid,
  p_decision text,
  p_role text default null,
  p_site_id uuid default null,
  p_note text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles;
  v_role text;
  v_org uuid;
  v_site uuid;
begin
  if auth.uid() is null or not (public.is_super_admin() or public.is_org_admin()) then
    raise exception 'Only an administrator can review access requests';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'You cannot review your own access request';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject';
  end if;

  select * into v_row from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'Access request not found';
  end if;

  v_org := coalesce(public.current_organization_id(), '00000000-0000-4000-8000-000000000001');

  if p_decision = 'reject' then
    update public.profiles
    set access_status = 'rejected',
        reviewed_at = now(),
        reviewed_by = auth.uid(),
        access_note = left(trim(coalesce(p_note, '')), 300)
    where id = p_profile_id
    returning * into v_row;
  else
    v_role := coalesce(nullif(p_role, ''), v_row.requested_role, v_row.role, 'worker');
    if public.is_super_admin() then
      if v_role not in (
        'super_admin', 'admin', 'operations_manager', 'supervisor', 'worker',
        'security_guard', 'client_admin', 'client_user', 'client'
      ) then
        v_role := 'worker';
      end if;
    else
      if v_role not in ('supervisor', 'worker', 'security_guard', 'client', 'client_user', 'client_admin') then
        v_role := 'worker';
      end if;
    end if;

    if p_site_id is not null then
      select s.id into v_site
      from public.sites s
      where s.id = p_site_id
        and (public.is_super_admin() or public.same_org(s.organization_id));
    end if;

    update public.profiles
    set access_status = 'active',
        role = v_role,
        organization_id = v_org,
        reviewed_at = now(),
        reviewed_by = auth.uid(),
        access_note = left(trim(coalesce(p_note, '')), 300)
    where id = p_profile_id
    returning * into v_row;

    if v_role in ('worker', 'supervisor', 'security_guard') and v_site is not null then
      insert into public.employees (
        profile_id, site_id, designation, job_title, employment_status, organization_id
      )
      select v_row.id, v_site, v_role,
        case v_role
          when 'supervisor' then 'Site Supervisor'
          when 'security_guard' then 'Security Guard'
          else 'Housekeeping Staff'
        end,
        'active',
        v_org
      where not exists (
        select 1 from public.employees e where e.profile_id = v_row.id
      );
    end if;
  end if;

  insert into public.audit_logs (organization_id, profile_id, action, module, record_table, record_id, metadata)
  values (
    v_org,
    auth.uid(),
    p_decision,
    'access',
    'profiles',
    p_profile_id,
    jsonb_build_object('decision', p_decision, 'role', v_row.role)
  );

  begin
    insert into public.notifications (organization_id, profile_id, message, is_read)
    values (
      v_row.organization_id,
      v_row.id,
      case
        when p_decision = 'approve' then 'Your FacilityOS access was approved. Sign in to open your portal.'
        else 'Your FacilityOS access request was not approved. Contact your administrator.'
      end,
      false
    );
  exception
    when others then
      null;
  end;

  return v_row;
end;
$$;

grant execute on function public.review_access_request(uuid, text, text, uuid, text) to authenticated;
