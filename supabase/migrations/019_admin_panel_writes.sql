-- Make the admin panel actually able to create/read records.
-- Org admins can manage their tenant. Super admin still can do everything.
-- Restrictive same_org policies from 014 stay in place. Safe to re-run.

-- See every tenant row in your org (not only rows linked to your own profile).
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_org_admin()
    or id in (
      select c.company_id from public.clients c
      where c.profile_id = auth.uid() and c.company_id is not null
    )
  );

drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies
  for insert to authenticated
  with check (public.is_super_admin() or public.is_org_admin());

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
  for update to authenticated
  using (public.is_super_admin() or public.is_org_admin())
  with check (public.is_super_admin() or public.is_org_admin());

drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_org_admin()
    or id in (select public.my_client_ids())
    or id in (
      select s.client_id from public.sites s
      where s.id in (select public.my_site_ids()) and s.client_id is not null
    )
  );

drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients
  for insert to authenticated
  with check (public.is_super_admin() or public.is_org_admin());

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients
  for update to authenticated
  using (public.is_super_admin() or public.is_org_admin() or id in (select public.my_client_ids()))
  with check (public.is_super_admin() or public.is_org_admin() or id in (select public.my_client_ids()));

drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients
  for delete to authenticated
  using (public.is_super_admin() or public.is_org_admin());

drop policy if exists sites_select on public.sites;
create policy sites_select on public.sites
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_org_admin()
    or id in (select public.my_site_ids())
  );

drop policy if exists sites_insert on public.sites;
create policy sites_insert on public.sites
  for insert to authenticated
  with check (public.is_super_admin() or public.is_org_admin());

drop policy if exists sites_update on public.sites;
create policy sites_update on public.sites
  for update to authenticated
  using (
    public.is_super_admin()
    or public.is_org_admin()
    or id in (select public.managed_site_ids())
  )
  with check (
    public.is_super_admin()
    or public.is_org_admin()
    or id in (select public.managed_site_ids())
  );

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_org_admin()
    or profile_id = auth.uid()
    or site_id in (select public.my_site_ids())
  );

drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees
  for insert to authenticated
  with check (public.is_super_admin() or public.is_org_admin());

drop policy if exists contracts_insert on public.contracts;
create policy contracts_insert on public.contracts
  for insert to authenticated
  with check (public.is_super_admin() or public.is_org_admin());

drop policy if exists contracts_update on public.contracts;
create policy contracts_update on public.contracts
  for update to authenticated
  using (public.is_super_admin() or public.is_org_admin())
  with check (public.is_super_admin() or public.is_org_admin());

drop policy if exists contracts_delete on public.contracts;
create policy contracts_delete on public.contracts
  for delete to authenticated
  using (public.is_super_admin() or public.is_org_admin());

drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.is_org_admin()
    or public.current_user_role() = 'supervisor'
  );
