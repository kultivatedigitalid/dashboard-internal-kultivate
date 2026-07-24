-- Correct role helper schema qualification used by task RPCs.

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
  if not (select private.is_admin()) then raise exception 'ADMIN_ONLY'; end if;
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
  if not (select private.is_admin()) then raise exception 'ADMIN_ONLY'; end if;
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

  if (select private.is_admin()) then
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
