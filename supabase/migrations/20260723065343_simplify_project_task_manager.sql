begin;

-- Remove the discontinued allowance feature and its API surface.
drop function if exists public.create_allowance(date, bigint, bigint, text, public.review_status);
drop function if exists public.admin_review_allowance(uuid, public.review_status, text);
drop table if exists public.allowances cascade;

-- Remove the old single-assignee task implementation and all test data.
drop function if exists public.update_task_progress(uuid, integer, text, text);
drop function if exists public.add_task_evidence(uuid, text);
drop function if exists public.toggle_task_checklist(uuid, boolean);
drop function if exists public.admin_create_task(text, text, uuid, public.task_priority, public.task_status, date, date, numeric, text[]);
drop function if exists public.admin_update_task(uuid, text, text, uuid, public.task_priority, public.task_status, date, date, numeric);
drop table if exists public.task_updates cascade;
drop table if exists public.task_checklist cascade;
drop table if exists public.tasks cascade;
drop type if exists public.task_status;
drop type if exists public.task_priority;

-- Evidence uploads belonged to the old task flow and are removed with its test data.
drop policy if exists evidence_select on storage.objects;
drop policy if exists evidence_insert on storage.objects;
drop policy if exists evidence_update on storage.objects;
drop policy if exists evidence_delete on storage.objects;
-- The work-evidence bucket is removed through the Storage API before this migration is applied.

create type public.task_priority as enum ('todo', 'important', 'urgent');
create type public.task_status as enum ('not_started', 'in_progress', 'completed');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 240),
  project_description text not null check (char_length(trim(project_description)) between 3 and 5000),
  how_to text not null check (char_length(trim(how_to)) between 3 and 5000),
  success_criteria text not null check (char_length(trim(success_criteria)) between 3 and 5000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  priority public.task_priority not null default 'todo',
  status public.task_status not null default 'not_started',
  progress integer not null default 0 check (progress between 0 and 100),
  start_date date not null,
  due_date date,
  progress_updated_by uuid references public.profiles(id) on delete set null,
  progress_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is null or due_date >= start_date)
);

create table public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (task_id, employee_id)
);

create index tasks_status_priority_due_idx on public.tasks(status, priority, due_date);
create index tasks_start_date_idx on public.tasks(start_date desc);
create index task_assignees_employee_task_idx on public.task_assignees(employee_id, task_id);

create or replace function private.sync_task_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.status := case
    when new.progress = 0 then 'not_started'::public.task_status
    when new.progress = 100 then 'completed'::public.task_status
    else 'in_progress'::public.task_status
  end;
  return new;
end;
$$;

create trigger tasks_sync_status
before insert or update of progress on public.tasks
for each row execute function private.sync_task_status();

create trigger tasks_touch
before update on public.tasks
for each row execute function private.touch_updated_at();

create or replace function private.is_task_assignee(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.task_assignees ta
      where ta.task_id = p_task_id
        and ta.employee_id = (select auth.uid())
    );
$$;
revoke all on function private.is_task_assignee(uuid) from public, anon;
grant execute on function private.is_task_assignee(uuid) to authenticated;

alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;

create policy tasks_select on public.tasks
for select to authenticated
using (
  (select private.is_admin())
  or ((select private.is_active_employee()) and (select private.is_task_assignee(id)))
);

create policy task_assignees_select on public.task_assignees
for select to authenticated
using (
  (select private.is_admin())
  or ((select private.is_active_employee()) and (select private.is_task_assignee(task_id)))
);

revoke all on public.tasks, public.task_assignees from public, anon, authenticated;
grant select on public.tasks, public.task_assignees to authenticated;

create or replace function public.admin_create_task(
  p_title text,
  p_project_description text,
  p_how_to text,
  p_success_criteria text,
  p_assignee_ids uuid[],
  p_priority public.task_priority,
  p_start_date date,
  p_due_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (select private.is_admin()) then raise exception 'ADMIN_REQUIRED'; end if;
  if char_length(trim(coalesce(p_title, ''))) < 3 then raise exception 'TASK_NAME_REQUIRED'; end if;
  if char_length(trim(coalesce(p_project_description, ''))) < 3 then raise exception 'PROJECT_DESCRIPTION_REQUIRED'; end if;
  if char_length(trim(coalesce(p_how_to, ''))) < 3 then raise exception 'HOW_TO_REQUIRED'; end if;
  if char_length(trim(coalesce(p_success_criteria, ''))) < 3 then raise exception 'SUCCESS_CRITERIA_REQUIRED'; end if;
  if p_start_date is null then raise exception 'START_DATE_REQUIRED'; end if;
  if p_due_date is not null and p_due_date < p_start_date then raise exception 'INVALID_DEADLINE'; end if;
  if p_assignee_ids is null or cardinality(p_assignee_ids) = 0 then raise exception 'ASSIGNEE_REQUIRED'; end if;
  if exists (
    select 1
    from unnest(p_assignee_ids) as selected(employee_id)
    left join public.profiles p on p.id = selected.employee_id and p.role = 'employee' and p.is_active
    where p.id is null
  ) then raise exception 'INVALID_ASSIGNEE'; end if;

  insert into public.tasks (
    title, project_description, how_to, success_criteria, created_by, priority, start_date, due_date
  ) values (
    trim(p_title), trim(p_project_description), trim(p_how_to), trim(p_success_criteria),
    (select auth.uid()), p_priority, p_start_date, p_due_date
  ) returning id into v_id;

  insert into public.task_assignees (task_id, employee_id)
  select v_id, selected.employee_id
  from (select distinct unnest(p_assignee_ids) as employee_id) selected;

  return v_id;
end;
$$;

create or replace function public.admin_update_task(
  p_id uuid,
  p_title text,
  p_project_description text,
  p_how_to text,
  p_success_criteria text,
  p_assignee_ids uuid[],
  p_priority public.task_priority,
  p_progress integer,
  p_start_date date,
  p_due_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_progress < 0 or p_progress > 100 then raise exception 'INVALID_PROGRESS'; end if;
  if char_length(trim(coalesce(p_title, ''))) < 3 then raise exception 'TASK_NAME_REQUIRED'; end if;
  if char_length(trim(coalesce(p_project_description, ''))) < 3 then raise exception 'PROJECT_DESCRIPTION_REQUIRED'; end if;
  if char_length(trim(coalesce(p_how_to, ''))) < 3 then raise exception 'HOW_TO_REQUIRED'; end if;
  if char_length(trim(coalesce(p_success_criteria, ''))) < 3 then raise exception 'SUCCESS_CRITERIA_REQUIRED'; end if;
  if p_start_date is null then raise exception 'START_DATE_REQUIRED'; end if;
  if p_due_date is not null and p_due_date < p_start_date then raise exception 'INVALID_DEADLINE'; end if;
  if p_assignee_ids is null or cardinality(p_assignee_ids) = 0 then raise exception 'ASSIGNEE_REQUIRED'; end if;
  if exists (
    select 1
    from unnest(p_assignee_ids) as selected(employee_id)
    left join public.profiles p on p.id = selected.employee_id and p.role = 'employee' and p.is_active
    where p.id is null
  ) then raise exception 'INVALID_ASSIGNEE'; end if;

  update public.tasks
  set title = trim(p_title),
      project_description = trim(p_project_description),
      how_to = trim(p_how_to),
      success_criteria = trim(p_success_criteria),
      priority = p_priority,
      progress = p_progress,
      start_date = p_start_date,
      due_date = p_due_date,
      progress_updated_by = case when progress is distinct from p_progress then (select auth.uid()) else progress_updated_by end,
      progress_updated_at = case when progress is distinct from p_progress then now() else progress_updated_at end
  where id = p_id;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;

  delete from public.task_assignees where task_id = p_id;
  insert into public.task_assignees (task_id, employee_id)
  select p_id, selected.employee_id
  from (select distinct unnest(p_assignee_ids) as employee_id) selected;
end;
$$;

create or replace function public.admin_delete_task(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then raise exception 'ADMIN_REQUIRED'; end if;
  delete from public.tasks where id = p_id;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;
end;
$$;

create or replace function public.update_task_progress(p_task_id uuid, p_progress integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_active_employee()) then raise exception 'EMPLOYEE_REQUIRED'; end if;
  if p_progress < 0 or p_progress > 100 then raise exception 'INVALID_PROGRESS'; end if;

  update public.tasks t
  set progress = p_progress,
      progress_updated_by = (select auth.uid()),
      progress_updated_at = now()
  where t.id = p_task_id
    and exists (
      select 1 from public.task_assignees ta
      where ta.task_id = t.id and ta.employee_id = (select auth.uid())
    );
  if not found then raise exception 'TASK_NOT_EDITABLE'; end if;
end;
$$;

revoke all on function public.admin_create_task(text, text, text, text, uuid[], public.task_priority, date, date) from public, anon;
revoke all on function public.admin_update_task(uuid, text, text, text, text, uuid[], public.task_priority, integer, date, date) from public, anon;
revoke all on function public.admin_delete_task(uuid) from public, anon;
revoke all on function public.update_task_progress(uuid, integer) from public, anon;

grant execute on function public.admin_create_task(text, text, text, text, uuid[], public.task_priority, date, date),
  public.admin_update_task(uuid, text, text, text, text, uuid[], public.task_priority, integer, date, date),
  public.admin_delete_task(uuid),
  public.update_task_progress(uuid, integer)
to authenticated;

comment on table public.tasks is 'Project-based tasks with automatic status derived from progress.';
comment on table public.task_assignees is 'Many-to-many assignment between tasks and active employees.';

commit;