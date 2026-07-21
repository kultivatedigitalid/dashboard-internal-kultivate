alter table public.profiles
  add column if not exists first_login_verified_at timestamptz;

comment on column public.profiles.first_login_verified_at is
  'Set only by the trusted application server after a successful Supabase email OTP verification.';

create table if not exists private.login_otp_challenges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sent_at timestamptz not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  updated_at timestamptz not null default now()
);

revoke all on table private.login_otp_challenges from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean language plpgsql stable security definer set search_path = ''
as $is_admin$
begin
  if (select auth.uid()) is null then return false; end if;
  return exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and is_active
      and first_login_verified_at is not null
  );
end;
$is_admin$;

create or replace function private.is_active_employee()
returns boolean language plpgsql stable security definer set search_path = ''
as $active_employee$
begin
  if (select auth.uid()) is null then return false; end if;
  return exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'employee'
      and is_active
      and first_login_verified_at is not null
  );
end;
$active_employee$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (
  (id = (select auth.uid()) and is_active)
  or (select private.is_admin())
);

create or replace function public.begin_first_login_otp()
returns table(expires_at timestamptz, resend_available_at timestamptz)
language plpgsql security definer set search_path = ''
as $begin_otp$
declare
  v_user_id uuid := (select auth.uid());
  v_last_sent timestamptz;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.profiles
    where id = v_user_id and is_active and first_login_verified_at is null
  ) then
    raise exception 'OTP_NOT_REQUIRED';
  end if;

  select challenge.sent_at into v_last_sent
  from private.login_otp_challenges challenge
  where challenge.user_id = v_user_id;

  if v_last_sent is not null and v_last_sent + interval '60 seconds' > now() then
    raise exception 'OTP_RESEND_WAIT';
  end if;

  insert into private.login_otp_challenges (user_id, sent_at, expires_at, attempts, updated_at)
  values (v_user_id, now(), now() + interval '10 minutes', 0, now())
  on conflict (user_id) do update set
    sent_at = excluded.sent_at,
    expires_at = excluded.expires_at,
    attempts = 0,
    updated_at = now();

  return query
  select challenge.expires_at, challenge.sent_at + interval '60 seconds'
  from private.login_otp_challenges challenge
  where challenge.user_id = v_user_id;
end;
$begin_otp$;

create or replace function public.consume_first_login_otp_attempt()
returns integer language plpgsql security definer set search_path = ''
as $consume_otp$
declare
  v_user_id uuid := (select auth.uid());
  v_challenge private.login_otp_challenges%rowtype;
  v_remaining integer;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.profiles
    where id = v_user_id and is_active and first_login_verified_at is null
  ) then
    raise exception 'OTP_NOT_REQUIRED';
  end if;

  select * into v_challenge
  from private.login_otp_challenges
  where user_id = v_user_id
  for update;

  if not found then raise exception 'OTP_NOT_REQUESTED'; end if;
  if v_challenge.expires_at <= now() then raise exception 'OTP_EXPIRED'; end if;
  if v_challenge.attempts >= 5 then raise exception 'OTP_ATTEMPTS_EXCEEDED'; end if;

  update private.login_otp_challenges
  set attempts = attempts + 1, updated_at = now()
  where user_id = v_user_id
  returning 5 - attempts into v_remaining;

  return v_remaining;
end;
$consume_otp$;

revoke all on function public.begin_first_login_otp() from public, anon;
revoke all on function public.consume_first_login_otp_attempt() from public, anon;
grant execute on function public.begin_first_login_otp() to authenticated;
grant execute on function public.consume_first_login_otp_attempt() to authenticated;

alter table public.workspace_settings
  alter column workspace_name set default 'Kultivate Digital ID';
update public.workspace_settings
set workspace_name = 'Kultivate Digital ID'
where workspace_name = 'Kultivate Digital ID';
