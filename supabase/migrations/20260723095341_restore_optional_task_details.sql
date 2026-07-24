-- Restore optional task guidance fields removed by the task contract refinement.

alter table public.tasks
  add column if not exists how_to text,
  add column if not exists success_criteria text;

alter table public.tasks
  drop constraint if exists tasks_how_to_length,
  add constraint tasks_how_to_length
    check (how_to is null or char_length(how_to) between 1 and 5000),
  drop constraint if exists tasks_success_criteria_length,
  add constraint tasks_success_criteria_length
    check (success_criteria is null or char_length(success_criteria) between 1 and 5000);

drop function if exists public.admin_create_task(text, text, uuid[], public.task_priority, date);
drop function if exists public.admin_update_task(uuid, text, text, uuid[], public.task_priority, integer, date);

create function public.admin_create_task(
  p_title text,
  p_project_description text,
  p_assignee_ids uuid[],
  p_priority public.task_priority,
  p_due_date date default null,
  p_how_to text default null,
  p_success_criteria text default null
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
  if length(trim(coalesce(p_how_to, ''))) > 5000 then raise exception 'HOW_TO_TOO_LONG'; end if;
  if length(trim(coalesce(p_success_criteria, ''))) > 5000 then raise exception 'SUCCESS_CRITERIA_TOO_LONG'; end if;
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
    title,
    project_description,
    how_to,
    success_criteria,
    created_by,
    priority,
    due_date
  )
  values (
    trim(p_title),
    trim(p_project_description),
    nullif(trim(coalesce(p_how_to, '')), ''),
    nullif(trim(coalesce(p_success_criteria, '')), ''),
    (select auth.uid()),
    p_priority,
    p_due_date
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

create function public.admin_update_task(
  p_id uuid,
  p_title text,
  p_project_description text,
  p_assignee_ids uuid[],
  p_priority public.task_priority,
  p_progress integer,
  p_due_date date default null,
  p_how_to text default null,
  p_success_criteria text default null
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
  if length(trim(coalesce(p_how_to, ''))) > 5000 then raise exception 'HOW_TO_TOO_LONG'; end if;
  if length(trim(coalesce(p_success_criteria, ''))) > 5000 then raise exception 'SUCCESS_CRITERIA_TOO_LONG'; end if;
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
      how_to = nullif(trim(coalesce(p_how_to, '')), ''),
      success_criteria = nullif(trim(coalesce(p_success_criteria, '')), ''),
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

revoke all on function public.admin_create_task(text, text, uuid[], public.task_priority, date, text, text)
  from public, anon;
revoke all on function public.admin_update_task(uuid, text, text, uuid[], public.task_priority, integer, date, text, text)
  from public, anon;
grant execute on function public.admin_create_task(text, text, uuid[], public.task_priority, date, text, text),
  public.admin_update_task(uuid, text, text, uuid[], public.task_priority, integer, date, text, text)
to authenticated;