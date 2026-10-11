-- Supervisor shift handover posts to announcements. Safe to re-run.

drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.is_org_admin()
    or public.current_user_role() = 'supervisor'
  );
