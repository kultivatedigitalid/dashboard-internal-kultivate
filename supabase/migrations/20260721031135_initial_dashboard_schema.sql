create schema if not exists private;

create type public.app_role as enum ('admin', 'employee');
create type public.review_status as enum ('draft', 'submitted', 'approved', 'rejected');
create type public.task_status as enum ('draft', 'not_started', 'in_progress', 'in_review', 'completed', 'archived');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.target_type as enum ('overall', 'weekly', 'monthly');
create type public.evaluation_visibility as enum ('employee', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  employee_code text unique,
  role public.app_role not null default 'employee',
  is_active boolean not null default true,
  portfolio_url text,
  joined_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_settings (
  id boolean primary key default true check (id),
  workspace_name text not null default 'Tim Internal',
  timezone text not null default 'Asia/Jakarta',
  weekly_target_hours numeric(8,2) not null default 40 check (weekly_target_hours >= 0),
  monthly_target_hours numeric(8,2) not null default 160 check (monthly_target_hours >= 0),
  overall_target_hours numeric(8,2) not null default 600 check (overall_target_hours >= 0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.workspace_settings (id) values (true);

create table public.targets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.target_type not null,
  target_hours numeric(8,2) not null check (target_hours >= 0),
  period_start date,
  period_end date,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end is null or period_start is null or period_end >= period_start)
);

create table public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  check_in timestamptz not null,
  check_out timestamptz,
  break_minutes integer not null default 0 check (break_minutes between 0 and 1440),
  work_mode text not null check (work_mode in ('office', 'remote')),
  activity_note text,
  status public.review_status not null default 'draft',
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date),
  check (check_out is null or check_out >= check_in)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 240),
  description text,
  assignee_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id),
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'not_started',
  start_date date,
  due_date date,
  estimate_hours numeric(8,2) check (estimate_hours is null or estimate_hours >= 0),
  progress integer not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date)
);

create table public.task_checklist (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  position integer not null default 0,
  is_done boolean not null default false,
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  progress integer not null check (progress between 0 and 100),
  note text,
  work_url text,
  evidence_path text,
  created_at timestamptz not null default now()
);

create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  summary text not null default '',
  achievements text,
  blockers text,
  next_plan text,
  video_url text,
  status public.review_status not null default 'draft',
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, week_start)
);

create table public.allowances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  expense_date date not null,
  transport_amount bigint not null default 0 check (transport_amount >= 0),
  meal_amount bigint not null default 0 check (meal_amount >= 0),
  notes text,
  receipt_path text,
  status public.review_status not null default 'draft',
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (transport_amount > 0 or meal_amount > 0)
);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 3 and 240),
  notes text not null,
  score smallint check (score between 1 and 5),
  visibility public.evaluation_visibility not null default 'employee',
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role) where is_active;
create index targets_employee_active_idx on public.targets(employee_id, target_type) where is_active;
create index work_sessions_employee_date_idx on public.work_sessions(employee_id, work_date desc);
create index work_sessions_review_idx on public.work_sessions(status, work_date desc);
create index tasks_assignee_status_idx on public.tasks(assignee_id, status, due_date);
create index task_checklist_task_position_idx on public.task_checklist(task_id, position);
create index task_updates_task_created_idx on public.task_updates(task_id, created_at desc);
create index weekly_reports_employee_week_idx on public.weekly_reports(employee_id, week_start desc);
create index weekly_reports_status_idx on public.weekly_reports(status, week_start desc);
create index allowances_employee_date_idx on public.allowances(employee_id, expense_date desc);
create index allowances_status_idx on public.allowances(status, expense_date desc);
create index evaluations_employee_published_idx on public.evaluations(employee_id, published_at desc) where is_published;

create or replace function private.is_admin()
returns boolean language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return false; end if;
  return exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and is_active
  );
end;
$$;
revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create or replace function private.is_active_employee()
returns boolean language plpgsql stable security definer set search_path = ''
as $active_employee$
begin
  if (select auth.uid()) is null then return false; end if;
  return exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'employee' and is_active
  );
end;
$active_employee$;
revoke all on function private.is_active_employee() from public, anon;
grant execute on function private.is_active_employee() to authenticated;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger targets_touch before update on public.targets for each row execute function private.touch_updated_at();
create trigger work_sessions_touch before update on public.work_sessions for each row execute function private.touch_updated_at();
create trigger tasks_touch before update on public.tasks for each row execute function private.touch_updated_at();
create trigger weekly_reports_touch before update on public.weekly_reports for each row execute function private.touch_updated_at();
create trigger allowances_touch before update on public.allowances for each row execute function private.touch_updated_at();
create trigger evaluations_touch before update on public.evaluations for each row execute function private.touch_updated_at();

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, employee_code, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'Pengguna'), '@', 1)),
    nullif(new.raw_user_meta_data ->> 'employee_code', ''),
    case when new.raw_app_meta_data ->> 'app_role' = 'admin' then 'admin'::public.app_role else 'employee'::public.app_role end
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    employee_code = coalesce(excluded.employee_code, public.profiles.employee_code),
    role = excluded.role;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert or update of email, raw_app_meta_data, raw_user_meta_data on auth.users
for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.targets enable row level security;
alter table public.work_sessions enable row level security;
alter table public.tasks enable row level security;
alter table public.task_checklist enable row level security;
alter table public.task_updates enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.allowances enable row level security;
alter table public.evaluations enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using ((id = (select auth.uid()) and (select private.is_active_employee())) or (select private.is_admin()));
create policy settings_select on public.workspace_settings for select to authenticated
using ((select private.is_active_employee()) or (select private.is_admin()));
create policy targets_select on public.targets for select to authenticated
using ((employee_id = (select auth.uid()) and (select private.is_active_employee())) or (select private.is_admin()));
create policy sessions_select on public.work_sessions for select to authenticated
using ((employee_id = (select auth.uid()) and (select private.is_active_employee())) or (select private.is_admin()));
create policy tasks_select on public.tasks for select to authenticated
using ((assignee_id = (select auth.uid()) and status not in ('draft', 'archived') and (select private.is_active_employee())) or (select private.is_admin()));
create policy checklist_select on public.task_checklist for select to authenticated
using (exists (select 1 from public.tasks t where t.id = task_id and ((t.assignee_id = (select auth.uid()) and (select private.is_active_employee())) or (select private.is_admin()))));
create policy task_updates_select on public.task_updates for select to authenticated
using ((employee_id = (select auth.uid()) and (select private.is_active_employee())) or (select private.is_admin()));
create policy reports_select on public.weekly_reports for select to authenticated
using ((employee_id = (select auth.uid()) and (select private.is_active_employee())) or (select private.is_admin()));
create policy allowances_select on public.allowances for select to authenticated
using ((employee_id = (select auth.uid()) and (select private.is_active_employee())) or (select private.is_admin()));
create policy evaluations_select on public.evaluations for select to authenticated
using ((employee_id = (select auth.uid()) and visibility = 'employee' and is_published and (select private.is_active_employee())) or (select private.is_admin()));

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on public.profiles, public.workspace_settings, public.targets, public.work_sessions, public.tasks,
  public.task_checklist, public.task_updates, public.weekly_reports, public.allowances, public.evaluations to authenticated;
grant usage on schema public to authenticated;



create or replace function public.update_my_profile(p_portfolio_url text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (select private.is_active_employee()) then raise exception 'EMPLOYEE_REQUIRED'; end if;
  if p_portfolio_url is not null and p_portfolio_url <> '' and p_portfolio_url !~ '^https?://' then raise exception 'INVALID_URL'; end if;
  update public.profiles set portfolio_url = nullif(p_portfolio_url, '')
  where id = (select auth.uid()) and is_active;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
end;
$$;

create or replace function public.check_in(p_work_mode text, p_activity_note text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not (select private.is_active_employee()) then raise exception 'EMPLOYEE_REQUIRED'; end if;
  if p_work_mode not in ('office', 'remote') then raise exception 'INVALID_WORK_MODE'; end if;
  insert into public.work_sessions (employee_id, work_date, check_in, work_mode, activity_note)
  values ((select auth.uid()), (now() at time zone 'Asia/Jakarta')::date, now(), p_work_mode, nullif(p_activity_note, ''))
  returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'ALREADY_CHECKED_IN';
end;
$$;

create or replace function public.check_out(p_break_minutes integer default 0, p_activity_note text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not (select private.is_active_employee()) then raise exception 'EMPLOYEE_REQUIRED'; end if;
  if p_break_minutes < 0 or p_break_minutes > 1440 then raise exception 'INVALID_BREAK'; end if;
  update public.work_sessions
  set check_out = now(), break_minutes = p_break_minutes,
      activity_note = coalesce(nullif(p_activity_note, ''), activity_note), status = 'submitted'
  where employee_id = (select auth.uid())
    and work_date = (now() at time zone 'Asia/Jakarta')::date
    and check_out is null and status = 'draft'
  returning id into v_id;
  if v_id is null then raise exception 'NO_OPEN_SESSION'; end if;
  return v_id;
end;
$$;

create or replace function public.save_weekly_report(
  p_week_start date, p_summary text, p_achievements text, p_blockers text,
  p_next_plan text, p_video_url text, p_status public.review_status
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not (select private.is_active_employee()) then raise exception 'EMPLOYEE_REQUIRED'; end if;
  if p_status not in ('draft', 'submitted') then raise exception 'INVALID_STATUS'; end if;
  if p_status = 'submitted' and char_length(trim(coalesce(p_summary, ''))) < 3 then raise exception 'SUMMARY_REQUIRED'; end if;
  insert into public.weekly_reports (employee_id, week_start, summary, achievements, blockers, next_plan, video_url, status, submitted_at)
  values ((select auth.uid()), p_week_start, coalesce(p_summary, ''), nullif(p_achievements, ''), nullif(p_blockers, ''),
    nullif(p_next_plan, ''), nullif(p_video_url, ''), p_status, case when p_status = 'submitted' then now() end)
  on conflict (employee_id, week_start) do update set
    summary = excluded.summary, achievements = excluded.achievements, blockers = excluded.blockers,
    next_plan = excluded.next_plan, video_url = excluded.video_url, status = excluded.status,
    submitted_at = excluded.submitted_at
  where public.weekly_reports.status in ('draft', 'rejected')
  returning id into v_id;
  if v_id is null then raise exception 'REPORT_LOCKED'; end if;
  return v_id;
end;
$$;

create or replace function public.create_allowance(
  p_expense_date date, p_transport_amount bigint, p_meal_amount bigint, p_notes text, p_status public.review_status
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not (select private.is_active_employee()) then raise exception 'EMPLOYEE_REQUIRED'; end if;
  if p_status not in ('draft', 'submitted') then raise exception 'INVALID_STATUS'; end if;
  if p_transport_amount < 0 or p_meal_amount < 0 or p_transport_amount + p_meal_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  insert into public.allowances (employee_id, expense_date, transport_amount, meal_amount, notes, status, submitted_at)
  values ((select auth.uid()), p_expense_date, p_transport_amount, p_meal_amount, nullif(p_notes, ''), p_status,
    case when p_status = 'submitted' then now() end)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.update_task_progress(p_task_id uuid, p_progress integer, p_note text, p_work_url text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (select private.is_active_employee()) then raise exception 'EMPLOYEE_REQUIRED'; end if;
  if p_progress < 0 or p_progress > 100 then raise exception 'INVALID_PROGRESS'; end if;
  if p_work_url is not null and p_work_url <> '' and p_work_url !~ '^https?://' then raise exception 'INVALID_URL'; end if;
  update public.tasks
  set progress = p_progress,
      status = case when p_progress = 100 then 'in_review'::public.task_status
                    when p_progress = 0 then 'not_started'::public.task_status
                    else 'in_progress'::public.task_status end
  where id = p_task_id and assignee_id = (select auth.uid()) and status not in ('draft', 'completed', 'archived');
  if not found then raise exception 'TASK_NOT_EDITABLE'; end if;
  insert into public.task_updates (task_id, employee_id, progress, note, work_url)
  values (p_task_id, (select auth.uid()), p_progress, nullif(p_note, ''), nullif(p_work_url, ''));
end;
$$;

create or replace function public.add_task_evidence(p_task_id uuid, p_evidence_path text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_progress integer;
begin
  if not (select private.is_active_employee()) then raise exception 'EMPLOYEE_REQUIRED'; end if;
  select progress into v_progress from public.tasks
  where id = p_task_id and assignee_id = (select auth.uid()) and status not in ('draft', 'completed', 'archived');
  if v_progress is null then raise exception 'TASK_NOT_EDITABLE'; end if;
  if split_part(p_evidence_path, '/', 1) <> (select auth.uid())::text then raise exception 'INVALID_PATH'; end if;
  insert into public.task_updates (task_id, employee_id, progress, evidence_path)
  values (p_task_id, (select auth.uid()), v_progress, p_evidence_path)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.toggle_task_checklist(p_item_id uuid, p_is_done boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (select private.is_active_employee()) then raise exception 'EMPLOYEE_REQUIRED'; end if;
  update public.task_checklist c
  set is_done = p_is_done,
      completed_by = case when p_is_done then (select auth.uid()) else null end,
      completed_at = case when p_is_done then now() else null end
  from public.tasks t
  where c.id = p_item_id and t.id = c.task_id and t.assignee_id = (select auth.uid())
    and t.status not in ('draft', 'completed', 'archived');
  if not found then raise exception 'CHECKLIST_NOT_EDITABLE'; end if;
end;
$$;

create or replace function public.admin_create_task(
  p_title text, p_description text, p_assignee_id uuid, p_priority public.task_priority,
  p_status public.task_status, p_start_date date, p_due_date date, p_estimate_hours numeric, p_checklist text[]
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_item text; v_position integer := 0;
begin
  if not (select private.is_admin()) then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists (select 1 from public.profiles where id = p_assignee_id and role = 'employee' and is_active) then raise exception 'INVALID_ASSIGNEE'; end if;
  insert into public.tasks (title, description, assignee_id, created_by, priority, status, start_date, due_date, estimate_hours)
  values (trim(p_title), nullif(p_description, ''), p_assignee_id, (select auth.uid()), p_priority, p_status,
    p_start_date, p_due_date, p_estimate_hours) returning id into v_id;
  foreach v_item in array coalesce(p_checklist, array[]::text[]) loop
    if trim(v_item) <> '' then
      insert into public.task_checklist (task_id, title, position) values (v_id, trim(v_item), v_position);
      v_position := v_position + 1;
    end if;
  end loop;
  return v_id;
end;
$$;

create or replace function public.admin_update_task(
  p_id uuid, p_title text, p_description text, p_assignee_id uuid, p_priority public.task_priority,
  p_status public.task_status, p_start_date date, p_due_date date, p_estimate_hours numeric
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (select private.is_admin()) then raise exception 'ADMIN_REQUIRED'; end if;
  update public.tasks set title = trim(p_title), description = nullif(p_description, ''), assignee_id = p_assignee_id,
    priority = p_priority, status = p_status, start_date = p_start_date, due_date = p_due_date, estimate_hours = p_estimate_hours
  where id = p_id;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;
end;
$$;

create or replace function public.admin_review_work_session(p_id uuid, p_decision public.review_status, p_review_note text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (select private.is_admin()) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'INVALID_DECISION'; end if;
  if p_decision = 'rejected' and trim(coalesce(p_review_note, '')) = '' then raise exception 'REVIEW_NOTE_REQUIRED'; end if;
  update public.work_sessions
  set status = p_decision, review_note = nullif(p_review_note, ''), reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = p_id and status = 'submitted';
  if not found then raise exception 'SESSION_NOT_REVIEWABLE'; end if;
end;
$$;

create or replace function public.admin_review_weekly_report(p_id uuid, p_decision public.review_status, p_review_note text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (select private.is_admin()) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'INVALID_DECISION'; end if;
  if p_decision = 'rejected' and trim(coalesce(p_review_note, '')) = '' then raise exception 'REVIEW_NOTE_REQUIRED'; end if;
  update public.weekly_reports
  set status = p_decision, review_note = nullif(p_review_note, ''), reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = p_id and status = 'submitted';
  if not found then raise exception 'REPORT_NOT_REVIEWABLE'; end if;
end;
$$;

create or replace function public.admin_review_allowance(p_id uuid, p_decision public.review_status, p_review_note text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (select private.is_admin()) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'INVALID_DECISION'; end if;
  if p_decision = 'rejected' and trim(coalesce(p_review_note, '')) = '' then raise exception 'REVIEW_NOTE_REQUIRED'; end if;
  update public.allowances
  set status = p_decision, review_note = nullif(p_review_note, ''), reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = p_id and status = 'submitted';
  if not found then raise exception 'ALLOWANCE_NOT_REVIEWABLE'; end if;
end;
$$;

create or replace function public.admin_upsert_target(
  p_employee_id uuid, p_target_type public.target_type, p_target_hours numeric, p_period_start date, p_period_end date
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not (select private.is_admin()) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_target_hours < 0 then raise exception 'INVALID_TARGET'; end if;
  update public.targets set is_active = false
  where employee_id = p_employee_id and target_type = p_target_type and is_active;
  insert into public.targets (employee_id, target_type, target_hours, period_start, period_end, created_by)
  values (p_employee_id, p_target_type, p_target_hours, p_period_start, p_period_end, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_create_evaluation(
  p_employee_id uuid, p_title text, p_notes text, p_score smallint,
  p_visibility public.evaluation_visibility, p_publish boolean
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not (select private.is_admin()) then raise exception 'ADMIN_REQUIRED'; end if;
  insert into public.evaluations (employee_id, author_id, title, notes, score, visibility, is_published, published_at)
  values (p_employee_id, (select auth.uid()), trim(p_title), trim(p_notes), p_score, p_visibility, p_publish,
    case when p_publish then now() end)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_update_workspace_settings(
  p_workspace_name text, p_timezone text, p_weekly numeric, p_monthly numeric, p_overall numeric
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (select private.is_admin()) then raise exception 'ADMIN_REQUIRED'; end if;
  if least(p_weekly, p_monthly, p_overall) < 0 then raise exception 'INVALID_TARGET'; end if;
  update public.workspace_settings
  set workspace_name = trim(p_workspace_name), timezone = p_timezone, weekly_target_hours = p_weekly,
      monthly_target_hours = p_monthly, overall_target_hours = p_overall,
      updated_by = (select auth.uid()), updated_at = now()
  where id;
end;
$$;

revoke all on function public.update_my_profile(text) from public, anon;
revoke all on function public.check_in(text, text) from public, anon;
revoke all on function public.check_out(integer, text) from public, anon;
revoke all on function public.save_weekly_report(date, text, text, text, text, text, public.review_status) from public, anon;
revoke all on function public.create_allowance(date, bigint, bigint, text, public.review_status) from public, anon;
revoke all on function public.update_task_progress(uuid, integer, text, text) from public, anon;
revoke all on function public.add_task_evidence(uuid, text) from public, anon;
revoke all on function public.toggle_task_checklist(uuid, boolean) from public, anon;
revoke all on function public.admin_create_task(text, text, uuid, public.task_priority, public.task_status, date, date, numeric, text[]) from public, anon;
revoke all on function public.admin_update_task(uuid, text, text, uuid, public.task_priority, public.task_status, date, date, numeric) from public, anon;
revoke all on function public.admin_review_work_session(uuid, public.review_status, text) from public, anon;
revoke all on function public.admin_review_weekly_report(uuid, public.review_status, text) from public, anon;
revoke all on function public.admin_review_allowance(uuid, public.review_status, text) from public, anon;
revoke all on function public.admin_upsert_target(uuid, public.target_type, numeric, date, date) from public, anon;
revoke all on function public.admin_create_evaluation(uuid, text, text, smallint, public.evaluation_visibility, boolean) from public, anon;
revoke all on function public.admin_update_workspace_settings(text, text, numeric, numeric, numeric) from public, anon;

grant execute on function public.update_my_profile(text), public.check_in(text, text), public.check_out(integer, text),
  public.save_weekly_report(date, text, text, text, text, text, public.review_status),
  public.create_allowance(date, bigint, bigint, text, public.review_status),
  public.update_task_progress(uuid, integer, text, text), public.add_task_evidence(uuid, text),
  public.toggle_task_checklist(uuid, boolean),
  public.admin_create_task(text, text, uuid, public.task_priority, public.task_status, date, date, numeric, text[]),
  public.admin_update_task(uuid, text, text, uuid, public.task_priority, public.task_status, date, date, numeric),
  public.admin_review_work_session(uuid, public.review_status, text),
  public.admin_review_weekly_report(uuid, public.review_status, text),
  public.admin_review_allowance(uuid, public.review_status, text),
  public.admin_upsert_target(uuid, public.target_type, numeric, date, date),
  public.admin_create_evaluation(uuid, text, text, smallint, public.evaluation_visibility, boolean),
  public.admin_update_workspace_settings(text, text, numeric, numeric, numeric)
to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('work-evidence', 'work-evidence', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy evidence_select on storage.objects for select to authenticated
using (
  bucket_id = 'work-evidence'
  and (((storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_active_employee())) or (select private.is_admin()))
);
create policy evidence_insert on storage.objects for insert to authenticated
with check (bucket_id = 'work-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_active_employee()));
create policy evidence_update on storage.objects for update to authenticated
using (bucket_id = 'work-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_active_employee()))
with check (bucket_id = 'work-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_active_employee()));
create policy evidence_delete on storage.objects for delete to authenticated
using (bucket_id = 'work-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_active_employee()));
