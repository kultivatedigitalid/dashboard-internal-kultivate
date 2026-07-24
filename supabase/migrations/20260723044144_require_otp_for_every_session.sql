drop function if exists public.begin_first_login_otp();
drop function if exists public.consume_first_login_otp_attempt();
drop table if exists private.login_otp_challenges;

create table private.login_otp_challenges (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  updated_at timestamptz not null default now()
);

create index login_otp_challenges_user_id_idx
  on private.login_otp_challenges (user_id);

create table private.login_otp_verifications (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  verified_at timestamptz not null default now()
);

create index login_otp_verifications_user_id_idx
  on private.login_otp_verifications (user_id);

revoke all on table private.login_otp_challenges from public, anon, authenticated;
revoke all on table private.login_otp_verifications from public, anon, authenticated;

create or replace function private.is_current_session_otp_verified()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $is_verified$
declare
  v_user_id uuid := (select auth.uid());
  v_session_id uuid := nullif((select auth.jwt() ->> 'session_id'), '')::uuid;
begin
  if v_user_id is null or v_session_id is null then
    return false;
  end if;

  return exists (
    select 1
    from private.login_otp_verifications verification
    where verification.user_id = v_user_id
      and verification.session_id = v_session_id
  );
end;
$is_verified$;

create or replace function private.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $is_admin$
begin
  if (select auth.uid()) is null then return false; end if;
  return (select private.is_current_session_otp_verified())
    and exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'admin'
        and is_active
    );
end;
$is_admin$;

create or replace function private.is_active_employee()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $active_employee$
begin
  if (select auth.uid()) is null then return false; end if;
  return (select private.is_current_session_otp_verified())
    and exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'employee'
        and is_active
    );
end;
$active_employee$;

create or replace function public.is_current_session_otp_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $public_is_verified$
  select private.is_current_session_otp_verified();
$public_is_verified$;

create or replace function public.begin_login_otp()
returns table(expires_at timestamptz, resend_available_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $begin_otp$
declare
  v_user_id uuid := (select auth.uid());
  v_session_id uuid := nullif((select auth.jwt() ->> 'session_id'), '')::uuid;
  v_last_sent timestamptz;
begin
  if v_user_id is null or v_session_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists (
    select 1
    from public.profiles
    where id = v_user_id and is_active
  ) then
    raise exception 'ACCOUNT_INACTIVE';
  end if;
  if (select private.is_current_session_otp_verified()) then
    raise exception 'OTP_NOT_REQUIRED';
  end if;

  select challenge.sent_at
  into v_last_sent
  from private.login_otp_challenges challenge
  where challenge.session_id = v_session_id;

  if v_last_sent is not null and v_last_sent + interval '60 seconds' > now() then
    raise exception 'OTP_RESEND_WAIT';
  end if;

  insert into private.login_otp_challenges (
    session_id,
    user_id,
    sent_at,
    expires_at,
    attempts,
    updated_at
  )
  values (
    v_session_id,
    v_user_id,
    now(),
    now() + interval '10 minutes',
    0,
    now()
  )
  on conflict (session_id) do update set
    sent_at = excluded.sent_at,
    expires_at = excluded.expires_at,
    attempts = 0,
    updated_at = now();

  return query
  select challenge.expires_at, challenge.sent_at + interval '60 seconds'
  from private.login_otp_challenges challenge
  where challenge.session_id = v_session_id;
end;
$begin_otp$;

create or replace function public.consume_login_otp_attempt()
returns integer
language plpgsql
security definer
set search_path = ''
as $consume_otp$
declare
  v_user_id uuid := (select auth.uid());
  v_session_id uuid := nullif((select auth.jwt() ->> 'session_id'), '')::uuid;
  v_challenge private.login_otp_challenges%rowtype;
  v_remaining integer;
begin
  if v_user_id is null or v_session_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if (select private.is_current_session_otp_verified()) then
    raise exception 'OTP_NOT_REQUIRED';
  end if;

  select *
  into v_challenge
  from private.login_otp_challenges
  where session_id = v_session_id and user_id = v_user_id
  for update;

  if not found then raise exception 'OTP_NOT_REQUESTED'; end if;
  if v_challenge.expires_at <= now() then raise exception 'OTP_EXPIRED'; end if;
  if v_challenge.attempts >= 5 then raise exception 'OTP_ATTEMPTS_EXCEEDED'; end if;

  update private.login_otp_challenges
  set attempts = attempts + 1, updated_at = now()
  where session_id = v_session_id and user_id = v_user_id
  returning 5 - attempts into v_remaining;

  return v_remaining;
end;
$consume_otp$;

create or replace function public.cancel_login_otp()
returns void
language sql
security definer
set search_path = ''
as $cancel_otp$
  delete from private.login_otp_challenges
  where user_id = (select auth.uid())
    and session_id = nullif((select auth.jwt() ->> 'session_id'), '')::uuid;
$cancel_otp$;

create or replace function public.complete_login_otp(
  p_user_id uuid,
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $complete_otp$
begin
  if not exists (
    select 1
    from private.login_otp_challenges challenge
    where challenge.user_id = p_user_id
      and challenge.session_id = p_session_id
      and challenge.expires_at > now()
      and challenge.attempts between 1 and 5
  ) then
    raise exception 'OTP_CHALLENGE_INVALID';
  end if;

  insert into private.login_otp_verifications (session_id, user_id, verified_at)
  values (p_session_id, p_user_id, now())
  on conflict (session_id) do update set
    user_id = excluded.user_id,
    verified_at = excluded.verified_at;

  update public.profiles
  set first_login_verified_at = coalesce(first_login_verified_at, now())
  where id = p_user_id;

  delete from private.login_otp_challenges
  where user_id = p_user_id and session_id = p_session_id;
end;
$complete_otp$;

revoke all on function private.is_current_session_otp_verified() from public, anon, authenticated;
revoke all on function public.is_current_session_otp_verified() from public, anon;
revoke all on function public.begin_login_otp() from public, anon;
revoke all on function public.consume_login_otp_attempt() from public, anon;
revoke all on function public.cancel_login_otp() from public, anon;
revoke all on function public.complete_login_otp(uuid, uuid) from public, anon, authenticated;

grant execute on function public.is_current_session_otp_verified() to authenticated;
grant execute on function public.begin_login_otp() to authenticated;
grant execute on function public.consume_login_otp_attempt() to authenticated;
grant execute on function public.cancel_login_otp() to authenticated;
grant execute on function public.complete_login_otp(uuid, uuid) to service_role;

comment on column public.profiles.first_login_verified_at is
  'Historical timestamp of the first successful email OTP. Current access is controlled per session.';