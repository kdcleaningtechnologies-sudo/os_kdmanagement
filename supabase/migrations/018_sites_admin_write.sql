-- Let organization admins create and update sites (not only super_admin).
-- Safe to re-run.

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
