-- Fix demo portal logins.
-- Run this in the Supabase SQL Editor if sign-in says "Invalid login credentials".
-- Password for every account below: FacilityOS@2026

create extension if not exists pgcrypto;

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

select public.seed_demo_user(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
  'westend.client@example.com',
  'FacilityOS@2026',
  'Priya Sharma',
  'client',
  '+91 98765 11011',
  'https://ui-avatars.com/api/?name=Priya+Sharma&background=0f8a7a&color=fff'
);

select public.seed_demo_user(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002',
  'harmony.client@example.com',
  'FacilityOS@2026',
  'Suresh Deshpande',
  'client',
  '+91 98765 11022',
  'https://ui-avatars.com/api/?name=Suresh+Deshpande&background=124440&color=fff'
);

select public.seed_demo_user(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0003',
  'supervisor@example.com',
  'FacilityOS@2026',
  'Ravi Patil',
  'supervisor',
  '+91 98765 22011',
  'https://ui-avatars.com/api/?name=Ravi+Patil&background=14b8a6&color=072422'
);

select public.seed_demo_user(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0004',
  'supervisor2@example.com',
  'FacilityOS@2026',
  'Meera Kulkarni',
  'supervisor',
  '+91 98765 22022',
  'https://ui-avatars.com/api/?name=Meera+Kulkarni&background=2dd4bf&color=072422'
);

select public.seed_demo_user(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0005',
  'worker@example.com',
  'FacilityOS@2026',
  'Anita More',
  'worker',
  '+91 98765 33011',
  'https://ui-avatars.com/api/?name=Anita+More&background=ccfbf1&color=072422'
);

select public.seed_demo_user(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0006',
  'worker2@example.com',
  'FacilityOS@2026',
  'Imran Shaikh',
  'worker',
  '+91 98765 33022',
  'https://ui-avatars.com/api/?name=Imran+Shaikh&background=d7eeeb&color=072422'
);

select public.seed_demo_user(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0007',
  'worker3@example.com',
  'FacilityOS@2026',
  'Kavita Jadhav',
  'worker',
  '+91 98765 33033',
  'https://ui-avatars.com/api/?name=Kavita+Jadhav&background=ece7dc&color=072422'
);

-- You should see 7 rows. Then confirm they exist:
select email, email_confirmed_at is not null as confirmed
from auth.users
where email like '%@example.com'
order by email;
