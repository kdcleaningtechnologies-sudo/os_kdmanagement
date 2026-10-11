-- Phase 9: assets, inventory, contract/invoice extras
-- Run after 010_phase8_security.sql
-- Payments stay stubbed. Training is not in this phase.

-- ---------------------------------------------------------------------------
-- Contract + invoice extras (existing pages keep working)
-- ---------------------------------------------------------------------------
alter table public.contracts add column if not exists site_id uuid references public.sites(id) on delete set null;
alter table public.contracts add column if not exists monthly_value numeric;
alter table public.contracts add column if not exists services text[] default '{}';
alter table public.contracts add column if not exists manpower integer;
alter table public.contracts add column if not exists renewal_date date;
alter table public.contracts add column if not exists status text;

update public.contracts set status = 'active' where status is null;

alter table public.contracts drop constraint if exists contracts_status_check;
alter table public.contracts
  add constraint contracts_status_check check (status in ('active', 'pending', 'expired'));

alter table public.contracts alter column status set default 'active';

alter table public.invoices add column if not exists site_id uuid references public.sites(id) on delete set null;
alter table public.invoices add column if not exists invoice_number text;
alter table public.invoices add column if not exists tax numeric default 0;
alter table public.invoices add column if not exists discount numeric default 0;
alter table public.invoices add column if not exists total numeric;
alter table public.invoices add column if not exists due_date date;

update public.invoices set total = coalesce(amount, 0) + coalesce(tax, 0) - coalesce(discount, 0) where total is null;

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.invoices drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.invoices add constraint invoices_status_check
  check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled'));

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null,
  category text not null default 'equipment' check (category in (
    'chemical', 'gloves', 'mop', 'bags', 'tissue', 'ppe', 'equipment'
  )),
  quantity numeric not null default 0,
  minimum_quantity numeric not null default 0,
  unit text not null default 'piece',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now()
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  kind text not null check (kind in ('in', 'out', 'adjust')),
  quantity numeric not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'in' then
    update public.inventory_items set quantity = quantity + new.quantity where id = new.item_id;
  elsif new.kind = 'out' then
    update public.inventory_items set quantity = greatest(0, quantity - new.quantity) where id = new.item_id;
  elsif new.kind = 'adjust' then
    update public.inventory_items set quantity = new.quantity where id = new.item_id;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_inventory_transaction on public.inventory_transactions;
create trigger apply_inventory_transaction
  after insert on public.inventory_transactions
  for each row execute function public.apply_inventory_transaction();

-- ---------------------------------------------------------------------------
-- Assets
-- ---------------------------------------------------------------------------
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  asset_code text,
  name text not null,
  serial_number text,
  purchase_date date,
  warranty_end date,
  last_service date,
  next_service date,
  condition text not null default 'good' check (condition in ('good', 'fair', 'needs_repair', 'retired')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.asset_maintenance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  service_date date not null default current_date,
  next_service date,
  cost numeric,
  notes text,
  created_at timestamptz default now()
);

create index if not exists inventory_items_site_id_idx on public.inventory_items (site_id);
create index if not exists inventory_items_organization_id_idx on public.inventory_items (organization_id);
create index if not exists inventory_transactions_item_id_idx on public.inventory_transactions (item_id);
create index if not exists assets_site_id_idx on public.assets (site_id);
create index if not exists assets_organization_id_idx on public.assets (organization_id);
create index if not exists asset_maintenance_asset_id_idx on public.asset_maintenance (asset_id);
create index if not exists contracts_site_id_idx on public.contracts (site_id);
create index if not exists invoices_due_date_idx on public.invoices (due_date);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.assets enable row level security;
alter table public.asset_maintenance enable row level security;

drop trigger if exists set_organization_id on public.inventory_items;
create trigger set_organization_id before insert on public.inventory_items
  for each row execute function public.set_organization_id();

drop trigger if exists set_organization_id on public.inventory_transactions;
create trigger set_organization_id before insert on public.inventory_transactions
  for each row execute function public.set_organization_id();

drop trigger if exists set_organization_id on public.assets;
create trigger set_organization_id before insert on public.assets
  for each row execute function public.set_organization_id();

drop trigger if exists set_organization_id on public.asset_maintenance;
create trigger set_organization_id before insert on public.asset_maintenance
  for each row execute function public.set_organization_id();

drop policy if exists inventory_items_select on public.inventory_items;
create policy inventory_items_select on public.inventory_items
  for select to authenticated
  using (public.can_read_security_site(site_id));

drop policy if exists inventory_items_write on public.inventory_items;
create policy inventory_items_write on public.inventory_items
  for all to authenticated
  using (public.can_write_security_site(site_id))
  with check (public.can_write_security_site(site_id));

drop policy if exists inventory_transactions_select on public.inventory_transactions;
create policy inventory_transactions_select on public.inventory_transactions
  for select to authenticated
  using (
    exists (
      select 1 from public.inventory_items i
      where i.id = item_id and public.can_read_security_site(i.site_id)
    )
  );

drop policy if exists inventory_transactions_write on public.inventory_transactions;
create policy inventory_transactions_write on public.inventory_transactions
  for all to authenticated
  using (
    exists (
      select 1 from public.inventory_items i
      where i.id = item_id and public.can_write_security_site(i.site_id)
    )
  )
  with check (
    exists (
      select 1 from public.inventory_items i
      where i.id = item_id and public.can_write_security_site(i.site_id)
    )
  );

drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets
  for select to authenticated
  using (public.can_read_security_site(site_id));

drop policy if exists assets_write on public.assets;
create policy assets_write on public.assets
  for all to authenticated
  using (public.can_write_security_site(site_id))
  with check (public.can_write_security_site(site_id));

drop policy if exists asset_maintenance_select on public.asset_maintenance;
create policy asset_maintenance_select on public.asset_maintenance
  for select to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_id and public.can_read_security_site(a.site_id)
    )
  );

drop policy if exists asset_maintenance_write on public.asset_maintenance;
create policy asset_maintenance_write on public.asset_maintenance
  for all to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_id and public.can_write_security_site(a.site_id)
    )
  )
  with check (
    exists (
      select 1 from public.assets a
      where a.id = asset_id and public.can_write_security_site(a.site_id)
    )
  );

select public.add_org_isolation('inventory_items');
select public.add_org_isolation('inventory_transactions');
select public.add_org_isolation('assets');
select public.add_org_isolation('asset_maintenance');

grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.inventory_transactions to authenticated;
grant select, insert, update, delete on public.assets to authenticated;
grant select, insert, update, delete on public.asset_maintenance to authenticated;

-- ---------------------------------------------------------------------------
-- Demo stock + machines (uses a real site; skipped if none)
-- ---------------------------------------------------------------------------
do $$
declare
  v_org uuid;
  v_site uuid;
begin
  select id into v_org from public.organizations order by created_at limit 1;
  select id into v_site from public.sites order by created_at limit 1;
  if v_org is null or v_site is null then
    raise notice 'Phase 9 tables are ready. Demo seed skipped: no organization or site.';
    return;
  end if;

  insert into public.inventory_items (id, organization_id, site_id, name, category, quantity, minimum_quantity, unit) values
    ('12121212-1111-4111-8111-000000000001', v_org, v_site, 'Floor cleaner', 'chemical', 8, 10, 'litre'),
    ('12121212-1111-4111-8111-000000000002', v_org, v_site, 'Nitrile gloves', 'gloves', 40, 20, 'pair'),
    ('12121212-1111-4111-8111-000000000003', v_org, v_site, 'Cotton mop', 'mop', 6, 4, 'piece'),
    ('12121212-1111-4111-8111-000000000004', v_org, v_site, 'Garbage bags', 'bags', 12, 15, 'pack'),
    ('12121212-1111-4111-8111-000000000005', v_org, v_site, 'Tissue rolls', 'tissue', 30, 12, 'roll'),
    ('12121212-1111-4111-8111-000000000006', v_org, v_site, 'Safety goggles', 'ppe', 10, 6, 'piece')
  on conflict (id) do update
    set site_id = excluded.site_id,
        quantity = excluded.quantity,
        minimum_quantity = excluded.minimum_quantity,
        organization_id = excluded.organization_id;

  insert into public.assets (id, organization_id, site_id, asset_code, name, serial_number, purchase_date, warranty_end, last_service, next_service, condition) values
    (
      '13131313-1111-4111-8111-000000000001',
      v_org, v_site, 'KD-AST-101', 'Floor scrubber', 'FS-88421',
      '2025-06-01', '2027-06-01', '2026-08-15', '2026-11-15', 'good'
    ),
    (
      '13131313-1111-4111-8111-000000000002',
      v_org, v_site, 'KD-AST-102', 'Vacuum machine', 'VC-22019',
      '2024-11-10', '2026-11-10', '2026-07-01', '2026-10-01', 'fair'
    )
  on conflict (id) do update
    set site_id = excluded.site_id,
        next_service = excluded.next_service,
        organization_id = excluded.organization_id;

  insert into public.asset_maintenance (id, organization_id, asset_id, service_date, next_service, cost, notes) values
    (
      '14141414-1111-4111-8111-000000000001',
      v_org,
      '13131313-1111-4111-8111-000000000001',
      '2026-08-15',
      '2026-11-15',
      4200,
      'Pad change and tank rinse'
    )
  on conflict (id) do update
    set notes = excluded.notes,
        organization_id = excluded.organization_id;
exception
  when others then
    raise notice 'Phase 9 tables are ready. Demo seed skipped: %', SQLERRM;
end $$;
