-- Refine the task contract and persist per-user notification read state.

update public.tasks
set priority = 'todo'
where priority = 'important';

alter table public.tasks
  drop constraint if exists tasks_allowed_priority,
  add constraint tasks_allowed_priority check (priority in ('todo', 'urgent')),
  drop constraint if exists tasks_due_date_check,
  drop column if exists how_to,
  drop column if exists success_criteria,
  drop column if exists start_date;

drop function if exists public.admin_create_task(text, text, text, text, uuid[], public.task_priority, date, date);
drop function if exists public.admin_update_task(uuid, text, text, text, text, uuid[], public.task_priority, integer, date, date);

create or replace function public.admin_create_task(
  p_title text,
  p_project_description text,
  p_assignee_ids uuid[],
  p_priority public.task_priority,
  p_due_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task_id uuid;
  v_assignee_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if length(trim(coalesce(p_title, ''))) < 3 then raise exception 'TASK_NAME_REQUIRED'; end if;
  if length(trim(coalesce(p_project_description, ''))) < 3 then raise exception 'PROJECT_DESCRIPTION_REQUIRED'; end if;
  if coalesce(array_length(p_assignee_ids, 1), 0) = 0 then raise exception 'ASSIGNEE_REQUIRED'; end if;
  if p_priority::text not in ('todo', 'urgent') then raise exception 'INVALID_PRIORITY'; end if;
  if exists (
    select 1
    from unnest(p_assignee_ids) as selected_id
    left join public.profiles profile on profile.id = selected_id
    where profile.id is null or profile.role <> 'employee' or not profile.is_active
  ) then
    raise exception 'INVALID_ASSIGNEE';
  end if;

  insert into public.tasks (
    title, project_description, created_by, priority, due_date
  )
  values (
    trim(p_title), trim(p_project_description), (select auth.uid()), p_priority, p_due_date
  )
  returning id into v_task_id;

  foreach v_assignee_id in array p_assignee_ids loop
    insert into public.task_assignees(task_id, employee_id)
    values (v_task_id, v_assignee_id)
    on conflict do nothing;
  end loop;
  return v_task_id;
end;
$$;

create or replace function public.admin_update_task(
  p_id uuid,
  p_title text,
  p_project_description text,
  p_assignee_ids uuid[],
  p_priority public.task_priority,
  p_progress integer,
  p_due_date date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignee_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if not exists (select 1 from public.tasks where id = p_id) then raise exception 'TASK_NOT_FOUND'; end if;
  if length(trim(coalesce(p_title, ''))) < 3 then raise exception 'TASK_NAME_REQUIRED'; end if;
  if length(trim(coalesce(p_project_description, ''))) < 3 then raise exception 'PROJECT_DESCRIPTION_REQUIRED'; end if;
  if coalesce(array_length(p_assignee_ids, 1), 0) = 0 then raise exception 'ASSIGNEE_REQUIRED'; end if;
  if p_priority::text not in ('todo', 'urgent') then raise exception 'INVALID_PRIORITY'; end if;
  if p_progress < 0 or p_progress > 100 then raise exception 'INVALID_PROGRESS'; end if;
  if exists (
    select 1
    from unnest(p_assignee_ids) as selected_id
    left join public.profiles profile on profile.id = selected_id
    where profile.id is null or profile.role <> 'employee' or not profile.is_active
  ) then
    raise exception 'INVALID_ASSIGNEE';
  end if;

  update public.tasks
  set title = trim(p_title),
      project_description = trim(p_project_description),
      priority = p_priority,
      progress = p_progress,
      due_date = p_due_date,
      updated_at = now()
  where id = p_id;

  delete from public.task_assignees where task_id = p_id;
  foreach v_assignee_id in array p_assignee_ids loop
    insert into public.task_assignees(task_id, employee_id)
    values (p_id, v_assignee_id)
    on conflict do nothing;
  end loop;
end;
$$;

revoke all on function public.admin_create_task(text, text, uuid[], public.task_priority, date) from public, anon;
revoke all on function public.admin_update_task(uuid, text, text, uuid[], public.task_priority, integer, date) from public, anon;
grant execute on function public.admin_create_task(text, text, uuid[], public.task_priority, date),
  public.admin_update_task(uuid, text, text, uuid[], public.task_priority, integer, date)
to authenticated;

create table public.task_notification_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.task_notification_state enable row level security;

create policy "task_notification_state_select_own"
on public.task_notification_state
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "task_notification_state_insert_own"
on public.task_notification_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "task_notification_state_update_own"
on public.task_notification_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.task_notification_state to authenticated;
revoke all on public.task_notification_state from anon;

insert into public.task_notification_state(user_id, last_seen_at, updated_at)
select id, now(), now()
from public.profiles
on conflict (user_id) do nothing;

create or replace function public.has_unread_task_notifications()
returns boolean
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_last_seen_at timestamptz;
begin
  if v_user_id is null then return false; end if;
  select state.last_seen_at into v_last_seen_at
  from public.task_notification_state state
  where state.user_id = v_user_id;
  v_last_seen_at := coalesce(v_last_seen_at, '-infinity'::timestamptz);

  if public.is_admin() then
    return exists (
      select 1
      from public.tasks task
      where greatest(task.created_at, task.updated_at) > v_last_seen_at
    );
  end if;

  return exists (
    select 1
    from public.task_assignees assignment
    join public.tasks task on task.id = assignment.task_id
    where assignment.employee_id = v_user_id
      and greatest(task.created_at, task.updated_at, assignment.assigned_at) > v_last_seen_at
  );
end;
$$;

create or replace function public.mark_task_notifications_read()
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := now();
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.task_notification_state(user_id, last_seen_at, updated_at)
  values (v_user_id, v_now, v_now)
  on conflict (user_id)
  do update set last_seen_at = excluded.last_seen_at, updated_at = excluded.updated_at;
  return v_now;
end;
$$;

revoke all on function public.has_unread_task_notifications() from public, anon;
revoke all on function public.mark_task_notifications_read() from public, anon;
grant execute on function public.has_unread_task_notifications(),
  public.mark_task_notifications_read()
to authenticated;