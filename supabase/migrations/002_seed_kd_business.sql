-- KD FacilityOS demo world
-- Run AFTER 001_initial_schema.sql in the Supabase SQL Editor.
-- Safe to re-run (upserts by fixed IDs / emails).
--
-- Demo password for every seeded portal user: FacilityOS@2026
--
--   Client (Westend)   westend.client@example.com
--   Client (Harmony)   harmony.client@example.com
--   Supervisor         supervisor@example.com
--   Supervisor 2       supervisor2@example.com
--   Worker             worker@example.com
--   Worker 2           worker2@example.com
--   Worker 3           worker3@example.com

create extension if not exists pgcrypto;

alter table public.sites add column if not exists services text[] default '{}';
alter table public.sites add column if not exists city text;
alter table public.sites add column if not exists shift_timings text;

-- ---------------------------------------------------------------------------
-- Helper: create or reuse an Auth user + profile
-- ---------------------------------------------------------------------------
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
begin
  v_hash := crypt(p_password, gen_salt('bf'));

  select u.id into v_id from auth.users u where u.id = p_id or u.email = p_email limit 1;

  if v_id is null then
    v_id := p_id;

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_id,
      'authenticated',
      'authenticated',
      p_email,
      v_hash,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_full_name, 'role', p_role, 'phone', p_phone),
      now(),
      now(),
      '',
      '',
      '',
      ''
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

  if not exists (
    select 1 from auth.identities i where i.user_id = v_id and i.provider = 'email'
  ) then
    begin
      insert into auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        v_id,
        v_id::text,
        jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
        'email',
        now(),
        now(),
        now()
      );
    exception
      when unique_violation then
        null;
      when undefined_column then
        insert into auth.identities (
          user_id,
          provider_id,
          identity_data,
          provider,
          last_sign_in_at,
          created_at,
          updated_at
        )
        values (
          v_id,
          v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
          'email',
          now(),
          now(),
          now()
        );
    end;
  end if;

  insert into public.profiles (id, full_name, role, phone, photo_url)
  values (v_id, p_full_name, p_role, p_phone, p_photo)
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = excluded.role,
        phone = excluded.phone,
        photo_url = excluded.photo_url;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
do $$
declare
  admin_id uuid;
  priya uuid;
  suresh uuid;
  ravi uuid;
  meera uuid;
  anita uuid;
  imran uuid;
  kavita uuid;
  password text := 'FacilityOS@2026';
begin
  select id into admin_id
  from auth.users
  where email = 'kdfacilitiesmanagementservices@gmail.com';

  if admin_id is not null then
    insert into public.profiles (id, full_name, role, phone, photo_url)
    values (
      admin_id,
      'KD Admin',
      'super_admin',
      '+91 98765 00001',
      'https://ui-avatars.com/api/?name=KD+Admin&background=072422&color=fff'
    )
    on conflict (id) do update
      set role = 'super_admin',
          full_name = coalesce(nullif(public.profiles.full_name, ''), 'KD Admin');
  end if;

  priya := public.seed_demo_user(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
    'westend.client@example.com',
    password,
    'Priya Sharma',
    'client',
    '+91 98765 11011',
    'https://ui-avatars.com/api/?name=Priya+Sharma&background=0f8a7a&color=fff'
  );

  suresh := public.seed_demo_user(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002',
    'harmony.client@example.com',
    password,
    'Suresh Deshpande',
    'client',
    '+91 98765 11022',
    'https://ui-avatars.com/api/?name=Suresh+Deshpande&background=124440&color=fff'
  );

  ravi := public.seed_demo_user(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0003',
    'supervisor@example.com',
    password,
    'Ravi Patil',
    'supervisor',
    '+91 98765 22011',
    'https://ui-avatars.com/api/?name=Ravi+Patil&background=14b8a6&color=072422'
  );

  meera := public.seed_demo_user(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0004',
    'supervisor2@example.com',
    password,
    'Meera Kulkarni',
    'supervisor',
    '+91 98765 22022',
    'https://ui-avatars.com/api/?name=Meera+Kulkarni&background=2dd4bf&color=072422'
  );

  anita := public.seed_demo_user(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0005',
    'worker@example.com',
    password,
    'Anita More',
    'worker',
    '+91 98765 33011',
    'https://ui-avatars.com/api/?name=Anita+More&background=ccfbf1&color=072422'
  );

  imran := public.seed_demo_user(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0006',
    'worker2@example.com',
    password,
    'Imran Shaikh',
    'worker',
    '+91 98765 33022',
    'https://ui-avatars.com/api/?name=Imran+Shaikh&background=d7eeeb&color=072422'
  );

  kavita := public.seed_demo_user(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0007',
    'worker3@example.com',
    password,
    'Kavita Jadhav',
    'worker',
    '+91 98765 33033',
    'https://ui-avatars.com/api/?name=Kavita+Jadhav&background=ece7dc&color=072422'
  );

  -- Companies
  insert into public.companies (id, name) values
    ('11111111-1111-4111-8111-111111111001', 'Westend Corporate Parks Pvt Ltd'),
    ('11111111-1111-4111-8111-111111111002', 'Harmony Co-operative Housing Society')
  on conflict (id) do update set name = excluded.name;

  -- Client records (portal users)
  insert into public.clients (id, company_id, profile_id, business_name, contact_email, contact_phone) values
    (
      '22222222-2222-4222-8222-222222222001',
      '11111111-1111-4111-8111-111111111001',
      priya,
      'Westend Corporate Parks',
      'facilities@westendparks.in',
      '+91 20 6767 1100'
    ),
    (
      '22222222-2222-4222-8222-222222222002',
      '11111111-1111-4111-8111-111111111002',
      suresh,
      'Harmony Housing Society',
      'committee@harmonychs.in',
      '+91 20 2685 4400'
    )
  on conflict (id) do update
    set profile_id = excluded.profile_id,
        business_name = excluded.business_name,
        contact_email = excluded.contact_email,
        contact_phone = excluded.contact_phone,
        company_id = excluded.company_id;

  -- Sites with live GPS pins (Pune)
  insert into public.sites (
    id, client_id, name, address, city, latitude, longitude, site_type, area_sqft, services, shift_timings
  ) values
    (
      '33333333-3333-4333-8333-333333333001',
      '22222222-2222-4222-8222-222222222001',
      'Westend IT Park — Hinjewadi',
      'Phase 1, Rajiv Gandhi Infotech Park, Hinjewadi, Pune',
      'Pune',
      18.5912,
      73.7376,
      'commercial',
      185000,
      array['housekeeping', 'pantry', 'facade', 'washrooms'],
      '07:00–19:00'
    ),
    (
      '33333333-3333-4333-8333-333333333002',
      '22222222-2222-4222-8222-222222222001',
      'Westend HQ — Kalyani Nagar',
      'Westend House, North Main Road, Kalyani Nagar, Pune',
      'Pune',
      18.5464,
      73.9015,
      'commercial',
      62000,
      array['housekeeping', 'security', 'pantry'],
      '08:00–20:00'
    ),
    (
      '33333333-3333-4333-8333-333333333003',
      '22222222-2222-4222-8222-222222222001',
      'Westend Logistics Hub — Chakan',
      'Plot B-14, MIDC Chakan Phase II, Pune',
      'Pune',
      18.7603,
      73.8618,
      'industrial',
      240000,
      array['housekeeping', 'security', 'material_bay'],
      '06:00–18:00'
    ),
    (
      '33333333-3333-4333-8333-333333333004',
      '22222222-2222-4222-8222-222222222002',
      'Harmony Towers — Magarpatta',
      'Towers A–D, Magarpatta City, Hadapsar, Pune',
      'Pune',
      18.5165,
      73.9268,
      'residential',
      410000,
      array['housekeeping', 'security', 'waste', 'common_area'],
      '06:30–14:30'
    ),
    (
      '33333333-3333-4333-8333-333333333005',
      '22222222-2222-4222-8222-222222222002',
      'Harmony Villas — Baner',
      'Baner–Pashan Link Road, Baner, Pune',
      'Pune',
      18.5590,
      73.7868,
      'residential',
      95000,
      array['housekeeping', 'security', 'garden'],
      '07:00–15:00'
    )
  on conflict (id) do update
    set name = excluded.name,
        address = excluded.address,
        city = excluded.city,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        site_type = excluded.site_type,
        area_sqft = excluded.area_sqft,
        services = excluded.services,
        shift_timings = excluded.shift_timings;

  -- Staff assignments
  insert into public.employees (id, profile_id, site_id, employee_code, designation, joining_date, documents) values
    ('44444444-4444-4444-8444-444444444001', ravi,   '33333333-3333-4333-8333-333333333001', 'KD-SUP-101', 'supervisor', '2024-04-01', '[]'::jsonb),
    ('44444444-4444-4444-8444-444444444002', ravi,   '33333333-3333-4333-8333-333333333002', 'KD-SUP-102', 'supervisor', '2024-04-01', '[]'::jsonb),
    ('44444444-4444-4444-8444-444444444003', ravi,   '33333333-3333-4333-8333-333333333003', 'KD-SUP-103', 'supervisor', '2024-06-15', '[]'::jsonb),
    ('44444444-4444-4444-8444-444444444004', meera,  '33333333-3333-4333-8333-333333333004', 'KD-SUP-201', 'supervisor', '2023-11-10', '[]'::jsonb),
    ('44444444-4444-4444-8444-444444444005', meera,  '33333333-3333-4333-8333-333333333005', 'KD-SUP-202', 'supervisor', '2024-01-08', '[]'::jsonb),
    ('44444444-4444-4444-8444-444444444006', anita,  '33333333-3333-4333-8333-333333333001', 'KD-WK-301',  'worker',     '2024-05-12', '[]'::jsonb),
    ('44444444-4444-4444-8444-444444444007', imran,  '33333333-3333-4333-8333-333333333002', 'KD-WK-302',  'worker',     '2024-07-01', '[]'::jsonb),
    ('44444444-4444-4444-8444-444444444008', kavita, '33333333-3333-4333-8333-333333333004', 'KD-WK-401',  'worker',     '2023-12-04', '[]'::jsonb)
  on conflict (id) do update
    set profile_id = excluded.profile_id,
        site_id = excluded.site_id,
        employee_code = excluded.employee_code,
        designation = excluded.designation;

  -- Contracts
  insert into public.contracts (id, client_id, start_date, end_date, sla_terms, billing_type, rate) values
    (
      '55555555-5555-4555-8555-555555555001',
      '22222222-2222-4222-8222-222222222001',
      '2026-04-01',
      '2027-03-31',
      'Housekeeping + pantry + washroom SLA. Response to client tickets within 4 working hours. Monthly inspection score target: 85. Night facade cleaning twice a month at Hinjewadi.',
      'per_sqft',
      4.25
    ),
    (
      '55555555-5555-4555-8555-555555555002',
      '22222222-2222-4222-8222-222222222002',
      '2026-01-01',
      '2026-12-31',
      'Society housekeeping, common-area security, wet waste segregation. Lift lobby mop twice daily. Garden maintenance at Baner villas on alternate days.',
      'fixed',
      285000
    )
  on conflict (id) do update
    set sla_terms = excluded.sla_terms,
        billing_type = excluded.billing_type,
        rate = excluded.rate;

  -- Invoices
  insert into public.invoices (id, client_id, contract_id, period, amount, status, created_at) values
    ('66666666-6666-4666-8666-666666666001', '22222222-2222-4222-8222-222222222001', '55555555-5555-4555-8555-555555555001', '2026-06', 2061250, 'paid',  '2026-06-30 10:00:00+05:30'),
    ('66666666-6666-4666-8666-666666666002', '22222222-2222-4222-8222-222222222001', '55555555-5555-4555-8555-555555555001', '2026-07', 2061250, 'paid',  '2026-07-31 10:00:00+05:30'),
    ('66666666-6666-4666-8666-666666666003', '22222222-2222-4222-8222-222222222001', '55555555-5555-4555-8555-555555555001', '2026-08', 2104000, 'sent',  '2026-08-31 10:00:00+05:30'),
    ('66666666-6666-4666-8666-666666666004', '22222222-2222-4222-8222-222222222001', '55555555-5555-4555-8555-555555555001', '2026-09', 2104000, 'draft', '2026-09-20 10:00:00+05:30'),
    ('66666666-6666-4666-8666-666666666005', '22222222-2222-4222-8222-222222222002', '55555555-5555-4555-8555-555555555002', '2026-07', 285000,  'paid',  '2026-07-31 10:00:00+05:30'),
    ('66666666-6666-4666-8666-666666666006', '22222222-2222-4222-8222-222222222002', '55555555-5555-4555-8555-555555555002', '2026-08', 285000,  'paid',  '2026-08-31 10:00:00+05:30'),
    ('66666666-6666-4666-8666-666666666007', '22222222-2222-4222-8222-222222222002', '55555555-5555-4555-8555-555555555002', '2026-09', 285000,  'sent',  '2026-09-18 10:00:00+05:30')
  on conflict (id) do update
    set amount = excluded.amount,
        status = excluded.status,
        period = excluded.period;

  -- Tasks
  insert into public.tasks (id, site_id, assigned_to, description, checklist, due_date, status) values
    (
      '77777777-7777-4777-8777-777777777001',
      '33333333-3333-4333-8333-333333333001',
      '44444444-4444-4444-8444-444444444006',
      'Hinjewadi morning housekeeping circuit',
      '[{"id":"c1","label":"Mop lift lobbies L1–L6","done":true},{"id":"c2","label":"Restock pantry on floors 2 and 5","done":true},{"id":"c3","label":"Sanitize washrooms Block B","done":false}]'::jsonb,
      current_date,
      'pending'
    ),
    (
      '77777777-7777-4777-8777-777777777002',
      '33333333-3333-4333-8333-333333333002',
      '44444444-4444-4444-8444-444444444007',
      'HQ reception and boardroom prep',
      '[{"id":"c1","label":"Vacuum reception carpet","done":true},{"id":"c2","label":"Boardroom glass and table","done":false}]'::jsonb,
      current_date,
      'pending'
    ),
    (
      '77777777-7777-4777-8777-777777777003',
      '33333333-3333-4333-8333-333333333004',
      '44444444-4444-4444-8444-444444444008',
      'Harmony common-area deep clean',
      '[{"id":"c1","label":"Podium garden walkways","done":true},{"id":"c2","label":"Clubhouse changing rooms","done":true},{"id":"c3","label":"Tower A garbage rooms","done":true}]'::jsonb,
      current_date - 1,
      'completed'
    )
  on conflict (id) do update
    set description = excluded.description,
        checklist = excluded.checklist,
        status = excluded.status,
        assigned_to = excluded.assigned_to;

  -- Inspections
  insert into public.inspection_reports (id, site_id, supervisor_id, photo_url, ai_score, ai_feedback, notes, created_at) values
    (
      '88888888-8888-4888-8888-888888888001',
      '33333333-3333-4333-8333-333333333001',
      '44444444-4444-4444-8444-444444444001',
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80',
      88,
      '{"floor_cleanliness":"pass","dust_detected":false,"bin_status":"ok","supplies_status":"ok","overall_score":88}'::jsonb,
      'Morning audit after pantry restock. Block B washrooms need one more pass.',
      now() - interval '12 days'
    ),
    (
      '88888888-8888-4888-8888-888888888002',
      '33333333-3333-4333-8333-333333333001',
      '44444444-4444-4444-8444-444444444001',
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
      81,
      '{"floor_cleanliness":"pass","dust_detected":true,"bin_status":"needs_attention","supplies_status":"low","overall_score":81}'::jsonb,
      'Client walkthrough with Priya. Dust on beam lights in atrium.',
      now() - interval '5 days'
    ),
    (
      '88888888-8888-4888-8888-888888888003',
      '33333333-3333-4333-8333-333333333004',
      '44444444-4444-4444-8444-444444444004',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
      91,
      '{"floor_cleanliness":"pass","dust_detected":false,"bin_status":"ok","supplies_status":"ok","overall_score":91}'::jsonb,
      'Society committee happy with podium finish.',
      now() - interval '2 days'
    )
  on conflict (id) do update
    set ai_score = excluded.ai_score,
        ai_feedback = excluded.ai_feedback,
        notes = excluded.notes;

  -- Complaints / maintenance
  insert into public.complaints (id, client_id, site_id, description, status, raised_at, resolved_at) values
    (
      '99999999-9999-4999-8999-999999999001',
      '22222222-2222-4222-8222-222222222001',
      '33333333-3333-4333-8333-333333333001',
      'Pantry on floor 5 ran out of paper cups before the 4pm meeting block.',
      'resolved',
      now() - interval '9 days',
      now() - interval '8 days'
    ),
    (
      '99999999-9999-4999-8999-999999999002',
      '22222222-2222-4222-8222-222222222001',
      '33333333-3333-4333-8333-333333333002',
      'Reception glass has fingerprints after visitor hours. Need an extra evening pass.',
      'in_progress',
      now() - interval '1 day',
      null
    ),
    (
      '99999999-9999-4999-8999-999999999003',
      '22222222-2222-4222-8222-222222222002',
      '33333333-3333-4333-8333-333333333004',
      'Tower C garbage room smell after weekend. Please schedule extra sanitization.',
      'open',
      now() - interval '6 hours',
      null
    ),
    (
      '99999999-9999-4999-8999-999999999004',
      '22222222-2222-4222-8222-222222222001',
      '33333333-3333-4333-8333-333333333003',
      'Maintenance: dock drain near bay 4 is clogged after monsoon wash.',
      'open',
      now() - interval '3 hours',
      null
    )
  on conflict (id) do update
    set description = excluded.description,
        status = excluded.status;

  -- Leave
  insert into public.leave_requests (id, employee_id, from_date, to_date, reason, status) values
    (
      'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaa0001',
      '44444444-4444-4444-8444-444444444006',
      current_date + 4,
      current_date + 5,
      'Family function in Satara',
      'pending'
    ),
    (
      'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaa0002',
      '44444444-4444-4444-8444-444444444008',
      current_date - 12,
      current_date - 11,
      'Fever',
      'approved'
    )
  on conflict (id) do update
    set status = excluded.status,
        reason = excluded.reason;

  -- Announcements
  insert into public.announcements (id, title, body, target_role) values
    (
      'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbb0001',
      'Monsoon safety on industrial sites',
      'Wear non-slip shoes at Chakan. Report standing water near the dock to your supervisor before starting the shift.',
      'worker'
    ),
    (
      'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbb0002',
      'September client audit week',
      'Westend HQ walkthrough is scheduled Thursday 11:00. Keep pantry counters clear and restock washroom supplies by 08:30.',
      'all'
    ),
    (
      'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbb0003',
      'New complaint SLA',
      'Open client tickets must move to in_progress within 4 working hours. Supervisors update notes in FacilityOS.',
      'supervisor'
    )
  on conflict (id) do update
    set title = excluded.title,
        body = excluded.body,
        target_role = excluded.target_role;
end;
$$;

-- Attendance for the last 16 days (skip Sundays) so charts are not empty
insert into public.attendance (
  id, employee_id, site_id, check_in_time, check_out_time, check_in_lat, check_in_lng, status, created_at
)
select
  ('ccccccc1-cccc-4ccc-8ccc-' || lpad((row_number() over ())::text, 12, '0'))::uuid,
  e.id,
  e.site_id,
  (d::timestamptz + interval '8 hours 12 minutes'),
  (d::timestamptz + interval '17 hours 5 minutes'),
  s.latitude + ((random() - 0.5) * 0.0008),
  s.longitude + ((random() - 0.5) * 0.0008),
  case
    when extract(dow from d) = 6 and random() < 0.15 then 'absent'
    when random() < 0.12 then 'late'
    else 'present'
  end,
  (d::timestamptz + interval '8 hours')
from public.employees e
join public.sites s on s.id = e.site_id
cross join generate_series(current_date - 16, current_date, interval '1 day') as d
where e.id in (
  '44444444-4444-4444-8444-444444444006',
  '44444444-4444-4444-8444-444444444007',
  '44444444-4444-4444-8444-444444444008'
)
  and extract(dow from d) <> 0
on conflict (id) do nothing;

-- Today's on-site check-ins for the three workers (overwrite-friendly unique ids)
insert into public.attendance (
  id, employee_id, site_id, check_in_time, check_out_time, check_in_lat, check_in_lng, status, created_at
) values
  (
    'ccccccc1-cccc-4ccc-8ccc-00000000today1',
    '44444444-4444-4444-8444-444444444006',
    '33333333-3333-4333-8333-333333333001',
    date_trunc('day', now()) + interval '8 hours 6 minutes',
    null,
    18.5913,
    73.7377,
    'present',
    now()
  ),
  (
    'ccccccc1-cccc-4ccc-8ccc-00000000today2',
    '44444444-4444-4444-8444-444444444007',
    '33333333-3333-4333-8333-333333333002',
    date_trunc('day', now()) + interval '8 hours 41 minutes',
    null,
    18.5465,
    73.9016,
    'late',
    now()
  )
on conflict (id) do update
  set check_in_time = excluded.check_in_time,
      status = excluded.status,
      check_out_time = excluded.check_out_time;
