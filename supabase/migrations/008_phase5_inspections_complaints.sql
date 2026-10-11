-- Phase 5: structured inspections, photos, complaint workflow + comments
-- Run after 007_phase4_tasks_checklists.sql
-- AI provider swap is Phase 10 — keep the existing stub.

-- ---------------------------------------------------------------------------
-- Inspections
-- ---------------------------------------------------------------------------
alter table public.inspection_reports add column if not exists status text;
alter table public.inspection_reports add column if not exists overall_score numeric;
alter table public.inspection_reports add column if not exists category text;

update public.inspection_reports
set status = 'submitted'
where status is null;

update public.inspection_reports
set overall_score = ai_score
where overall_score is null and ai_score is not null;

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.inspection_reports'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.inspection_reports drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.inspection_reports add constraint inspection_reports_status_check
  check (status in ('draft', 'submitted', 'reviewed'));

alter table public.inspection_reports alter column status set default 'draft';

create table if not exists public.inspection_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspection_reports(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  category text not null,
  score numeric,
  remarks text,
  status text not null default 'pending' check (status in ('pending', 'pass', 'fail', 'needs_attention')),
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspection_reports(id) on delete cascade,
  inspection_item_id uuid references public.inspection_items(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  photo_url text not null,
  storage_path text,
  caption text,
  created_at timestamptz default now()
);

create index if not exists inspection_items_inspection_id_idx on public.inspection_items (inspection_id);
create index if not exists inspection_photos_inspection_id_idx on public.inspection_photos (inspection_id);

-- ---------------------------------------------------------------------------
-- Complaints
-- ---------------------------------------------------------------------------
alter table public.complaints add column if not exists title text;
alter table public.complaints add column if not exists category text;
alter table public.complaints add column if not exists priority text;
alter table public.complaints add column if not exists assigned_to uuid references public.employees(id) on delete set null;
alter table public.complaints add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.complaints add column if not exists photos jsonb default '[]'::jsonb;

update public.complaints
set title = left(coalesce(description, 'Complaint'), 80)
where title is null;

update public.complaints set category = 'general' where category is null;
update public.complaints set priority = 'medium' where priority is null;
update public.complaints set photos = '[]'::jsonb where photos is null;

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.complaints'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.complaints drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.complaints add constraint complaints_status_check
  check (status in ('open', 'assigned', 'in_progress', 'resolved', 'client_confirmed', 'closed'));

alter table public.complaints drop constraint if exists complaints_priority_check;
alter table public.complaints add constraint complaints_priority_check
  check (priority in ('low', 'medium', 'high', 'urgent'));

alter table public.complaints alter column priority set default 'medium';
alter table public.complaints alter column category set default 'general';

create table if not exists public.complaint_comments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists complaint_comments_complaint_id_idx on public.complaint_comments (complaint_id);
create index if not exists complaints_assigned_to_idx on public.complaints (assigned_to);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.inspection_items enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.complaint_comments enable row level security;

drop trigger if exists set_organization_id on public.inspection_items;
create trigger set_organization_id before insert on public.inspection_items
  for each row execute function public.set_organization_id();

drop trigger if exists set_organization_id on public.inspection_photos;
create trigger set_organization_id before insert on public.inspection_photos
  for each row execute function public.set_organization_id();

drop trigger if exists set_organization_id on public.complaint_comments;
create trigger set_organization_id before insert on public.complaint_comments
  for each row execute function public.set_organization_id();

drop policy if exists inspection_reports_insert on public.inspection_reports;
create policy inspection_reports_insert on public.inspection_reports
  for insert to authenticated
  with check (
    public.is_org_admin()
    or site_id in (select public.managed_site_ids())
  );

drop policy if exists inspection_reports_update on public.inspection_reports;
create policy inspection_reports_update on public.inspection_reports
  for update to authenticated
  using (
    public.is_org_admin()
    or site_id in (select public.managed_site_ids())
  )
  with check (
    public.is_org_admin()
    or site_id in (select public.managed_site_ids())
  );

drop policy if exists inspection_items_select on public.inspection_items;
create policy inspection_items_select on public.inspection_items
  for select to authenticated
  using (
    exists (
      select 1 from public.inspection_reports r
      where r.id = inspection_id
        and (
          public.is_org_admin()
          or r.site_id in (select public.my_site_ids())
        )
    )
  );

drop policy if exists inspection_items_write on public.inspection_items;
create policy inspection_items_write on public.inspection_items
  for all to authenticated
  using (
    exists (
      select 1 from public.inspection_reports r
      where r.id = inspection_id
        and (
          public.is_org_admin()
          or r.site_id in (select public.managed_site_ids())
        )
    )
  )
  with check (
    exists (
      select 1 from public.inspection_reports r
      where r.id = inspection_id
        and (
          public.is_org_admin()
          or r.site_id in (select public.managed_site_ids())
        )
    )
  );

drop policy if exists inspection_photos_select on public.inspection_photos;
create policy inspection_photos_select on public.inspection_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.inspection_reports r
      where r.id = inspection_id
        and (
          public.is_org_admin()
          or r.site_id in (select public.my_site_ids())
        )
    )
  );

drop policy if exists inspection_photos_write on public.inspection_photos;
create policy inspection_photos_write on public.inspection_photos
  for all to authenticated
  using (
    exists (
      select 1 from public.inspection_reports r
      where r.id = inspection_id
        and (
          public.is_org_admin()
          or r.site_id in (select public.managed_site_ids())
        )
    )
  )
  with check (
    exists (
      select 1 from public.inspection_reports r
      where r.id = inspection_id
        and (
          public.is_org_admin()
          or r.site_id in (select public.managed_site_ids())
        )
    )
  );

drop policy if exists complaints_insert on public.complaints;
create policy complaints_insert on public.complaints
  for insert to authenticated
  with check (
    public.is_org_admin()
    or client_id in (select public.my_client_ids())
    or site_id in (select public.managed_site_ids())
  );

drop policy if exists complaints_update on public.complaints;
create policy complaints_update on public.complaints
  for update to authenticated
  using (
    public.is_org_admin()
    or client_id in (select public.my_client_ids())
    or site_id in (select public.managed_site_ids())
  )
  with check (
    public.is_org_admin()
    or client_id in (select public.my_client_ids())
    or site_id in (select public.managed_site_ids())
  );

drop policy if exists complaint_comments_select on public.complaint_comments;
create policy complaint_comments_select on public.complaint_comments
  for select to authenticated
  using (
    exists (
      select 1 from public.complaints c
      where c.id = complaint_id
        and (
          public.is_org_admin()
          or c.client_id in (select public.my_client_ids())
          or c.site_id in (select public.my_site_ids())
        )
    )
  );

drop policy if exists complaint_comments_insert on public.complaint_comments;
create policy complaint_comments_insert on public.complaint_comments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.complaints c
      where c.id = complaint_id
        and (
          public.is_org_admin()
          or c.client_id in (select public.my_client_ids())
          or c.site_id in (select public.managed_site_ids())
          or c.site_id in (select public.my_site_ids())
        )
    )
  );

select public.add_org_isolation('inspection_items');
select public.add_org_isolation('inspection_photos');
select public.add_org_isolation('complaint_comments');

grant select, insert, update, delete on public.inspection_items to authenticated;
grant select, insert, update, delete on public.inspection_photos to authenticated;
grant select, insert, update, delete on public.complaint_comments to authenticated;

-- Complaint photo bucket (same pattern as inspection-photos)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'complaint-photos',
  'complaint-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

drop policy if exists complaint_photos_public_read on storage.objects;
create policy complaint_photos_public_read on storage.objects
  for select to public
  using (bucket_id = 'complaint-photos');

drop policy if exists complaint_photos_auth_insert on storage.objects;
create policy complaint_photos_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'complaint-photos');

-- Backfill category rows onto existing submitted inspections
insert into public.inspection_items (inspection_id, organization_id, category, score, status, sort_order)
select
  r.id,
  r.organization_id,
  v.category,
  case when v.sort_order = 1 then r.overall_score else null end,
  case
    when v.sort_order = 1 and r.overall_score >= 85 then 'pass'
    when v.sort_order = 1 and r.overall_score is not null then 'needs_attention'
    else 'pending'
  end,
  v.sort_order
from public.inspection_reports r
cross join (values
  ('Cleanliness', 1),
  ('Washroom', 2),
  ('Floor', 3),
  ('Pantry', 4),
  ('Waste', 5)
) as v(category, sort_order)
where not exists (
  select 1 from public.inspection_items i where i.inspection_id = r.id
);

insert into public.inspection_photos (inspection_id, organization_id, photo_url)
select r.id, r.organization_id, r.photo_url
from public.inspection_reports r
where r.photo_url is not null
  and not exists (
    select 1 from public.inspection_photos p
    where p.inspection_id = r.id and p.photo_url = r.photo_url
  );
