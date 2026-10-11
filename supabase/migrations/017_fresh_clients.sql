-- Remove all current clients (Sudewa FC, KD Demo Client, and any others)
-- plus their sites and leftover company rows, so you can add clients fresh.
-- Admin login and the KD organization stay. Safe to re-run.

do $$
begin
  update public.sites set supervisor_id = null;
  update public.employees set site_id = null, supervisor_id = null;

  delete from public.clients;
  delete from public.sites where client_id is null;
  delete from public.companies;
end;
$$;

drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients
  for delete to authenticated
  using (public.is_super_admin() or public.is_org_admin());
