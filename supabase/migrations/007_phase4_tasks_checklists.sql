-- Phase 4: task fields, reusable checklists, org-admin task write
-- Run after 006_phase3_shifts_attendance.sql

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  site_type text,
  site_id uuid references public.sites(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now()
);

create table if not exists public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0
);

alter table public.tasks add column if not exists title text;
alter table public.tasks add column if not exists priority text;
alter table public.tasks add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.tasks add column if not exists recurrence text;
alter table public.tasks add column if not exists checklist_template_id uuid references public.checklist_templates(id) on delete set null;

update public.tasks set title = left(coalesce(description, 'Task'), 80) where title is null;
update public.tasks set priority = 'medium' where priority is null;
update public.tasks set recurrence = 'none' where recurrence is null;
update public.tasks set status = 'todo' where status = 'pending';

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.tasks drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.tasks add constraint tasks_status_check
  check (status in ('todo', 'in_progress', 'completed', 'overdue', 'pending'));

alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks add constraint tasks_priority_check
  check (priority in ('low', 'medium', 'high', 'urgent'));

alter table public.tasks drop constraint if exists tasks_recurrence_check;
alter table public.tasks add constraint tasks_recurrence_check
  check (recurrence in ('none', 'daily', 'weekly'));

alter table public.tasks alter column priority set default 'medium';
alter table public.tasks alter column recurrence set default 'none';
alter table public.tasks alter column status set default 'todo';

create index if not exists tasks_due_date_idx on public.tasks (due_date);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists checklist_templates_organization_id_idx on public.checklist_templates (organization_id);
create index if not exists checklist_templates_site_id_idx on public.checklist_templates (site_id);
create index if not exists checklist_template_items_template_id_idx on public.checklist_template_items (template_id);

alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;

drop trigger if exists set_organization_id on public.checklist_templates;
create trigger set_organization_id before insert on public.checklist_templates
  for each row execute function public.set_organization_id();

drop trigger if exists set_organization_id on public.checklist_template_items;
create trigger set_organization_id before insert on public.checklist_template_items
  for each row execute function public.set_organization_id();

drop policy if exists checklist_templates_select on public.checklist_templates;
create policy checklist_templates_select on public.checklist_templates
  for select to authenticated
  using (public.same_org(organization_id));

drop policy if exists checklist_templates_write on public.checklist_templates;
create policy checklist_templates_write on public.checklist_templates
  for all to authenticated
  using (public.is_org_admin() and public.same_org(organization_id))
  with check (public.is_org_admin() and public.same_org(organization_id));

drop policy if exists checklist_template_items_select on public.checklist_template_items;
create policy checklist_template_items_select on public.checklist_template_items
  for select to authenticated
  using (public.same_org(organization_id));

drop policy if exists checklist_template_items_write on public.checklist_template_items;
create policy checklist_template_items_write on public.checklist_template_items
  for all to authenticated
  using (public.is_org_admin() and public.same_org(organization_id))
  with check (public.is_org_admin() and public.same_org(organization_id));

select public.add_org_isolation('checklist_templates');
select public.add_org_isolation('checklist_template_items');

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    public.is_org_admin()
    or site_id in (select public.managed_site_ids())
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    public.is_org_admin()
    or site_id in (select public.managed_site_ids())
    or assigned_to in (select public.my_employee_ids())
  )
  with check (
    public.is_org_admin()
    or site_id in (select public.managed_site_ids())
    or assigned_to in (select public.my_employee_ids())
  );

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (
    public.is_org_admin()
    or site_id in (select public.managed_site_ids())
  );

create or replace function public.spawn_recurring_task(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
  nid uuid;
  next_due date;
  next_list jsonb;
begin
  select * into t from public.tasks where id = p_task_id;
  if not found then
    raise exception 'Task not found';
  end if;

  if not (
    public.is_org_admin()
    or t.site_id in (select public.managed_site_ids())
    or t.assigned_to in (select public.my_employee_ids())
  ) then
    raise exception 'Not allowed to recur this task';
  end if;

  if t.recurrence is null or t.recurrence = 'none' then
    return null;
  end if;

  next_due := case
    when t.recurrence = 'daily' then coalesce(t.due_date, current_date) + 1
    else coalesce(t.due_date, current_date) + 7
  end;

  select coalesce(
    jsonb_agg(jsonb_set(item, '{done}', 'false') order by ord),
    '[]'::jsonb
  )
  into next_list
  from jsonb_array_elements(coalesce(t.checklist, '[]'::jsonb)) with ordinality as x(item, ord);

  insert into public.tasks (
    organization_id, site_id, assigned_to, title, description, checklist, due_date,
    status, priority, created_by, recurrence, checklist_template_id
  ) values (
    t.organization_id, t.site_id, t.assigned_to, t.title, t.description, next_list, next_due,
    'todo', t.priority, t.created_by, t.recurrence, t.checklist_template_id
  ) returning id into nid;

  return nid;
end;
$$;

grant execute on function public.spawn_recurring_task(uuid) to authenticated;
grant select, insert, update, delete on public.checklist_templates to authenticated;
grant select, insert, update, delete on public.checklist_template_items to authenticated;

-- KD reusable checklists from the facility spec
insert into public.checklist_templates (id, organization_id, name, site_type, status)
values
  ('eeeeeeee-1111-4111-8111-000000000001', '00000000-0000-4000-8000-000000000001', 'Corporate office daily', 'corporate', 'active'),
  ('eeeeeeee-1111-4111-8111-000000000002', '00000000-0000-4000-8000-000000000001', 'Warehouse daily', 'warehouse', 'active'),
  ('eeeeeeee-1111-4111-8111-000000000003', '00000000-0000-4000-8000-000000000001', 'Residential common areas', 'residential', 'active')
on conflict (id) do update
  set name = excluded.name, site_type = excluded.site_type, status = excluded.status;

insert into public.checklist_template_items (template_id, organization_id, label, sort_order)
select v.template_id, '00000000-0000-4000-8000-000000000001', v.label, v.sort_order
from (values
  ('eeeeeeee-1111-4111-8111-000000000001'::uuid, 'Reception', 1),
  ('eeeeeeee-1111-4111-8111-000000000001', 'Workstations', 2),
  ('eeeeeeee-1111-4111-8111-000000000001', 'Meeting room', 3),
  ('eeeeeeee-1111-4111-8111-000000000001', 'Pantry', 4),
  ('eeeeeeee-1111-4111-8111-000000000001', 'Washroom', 5),
  ('eeeeeeee-1111-4111-8111-000000000001', 'Corridor', 6),
  ('eeeeeeee-1111-4111-8111-000000000001', 'Floor', 7),
  ('eeeeeeee-1111-4111-8111-000000000002', 'Floor', 1),
  ('eeeeeeee-1111-4111-8111-000000000002', 'Loading area', 2),
  ('eeeeeeee-1111-4111-8111-000000000002', 'Storage', 3),
  ('eeeeeeee-1111-4111-8111-000000000002', 'Machinery', 4),
  ('eeeeeeee-1111-4111-8111-000000000002', 'Waste area', 5),
  ('eeeeeeee-1111-4111-8111-000000000003', 'Lobby', 1),
  ('eeeeeeee-1111-4111-8111-000000000003', 'Lift lobby', 2),
  ('eeeeeeee-1111-4111-8111-000000000003', 'Staircase', 3),
  ('eeeeeeee-1111-4111-8111-000000000003', 'Common washroom', 4),
  ('eeeeeeee-1111-4111-8111-000000000003', 'Parking', 5)
) as v(template_id, label, sort_order)
where not exists (
  select 1 from public.checklist_template_items i
  where i.template_id = v.template_id and i.label = v.label
);
