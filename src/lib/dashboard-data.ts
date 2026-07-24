import type { APIContext } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DashboardTask, TaskPriority, TaskStatus } from '@/lib/types';

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  employee_code: string | null;
  role: 'admin' | 'employee';
  is_active: boolean;
  portfolio_url: string | null;
  joined_at: string;
  first_login_verified_at: string | null;
}
export interface SettingsRow {
  workspace_name: string;
  timezone: string;
  weekly_target_hours: number;
  monthly_target_hours: number;
  overall_target_hours: number;
}
export interface TargetRow {
  id: string;
  employee_id: string;
  target_type: 'overall' | 'weekly' | 'monthly';
  target_hours: number;
  period_start: string | null;
  period_end: string | null;
  is_active: boolean;
}
export interface SessionRow {
  id: string;
  employee_id: string;
  work_date: string;
  check_in: string;
  check_out: string | null;
  break_minutes: number;
  work_mode: 'office' | 'remote';
  activity_note: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  review_note: string | null;
}
export interface TaskRow {
  id: string;
  title: string;
  project_description: string;
  how_to: string | null;
  success_criteria: string | null;
  created_by: string;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  due_date: string | null;
  progress_updated_by: string | null;
  progress_updated_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface TaskAssigneeRow {
  task_id: string;
  employee_id: string;
  assigned_at: string;
}
export interface ReportRow {
  id: string;
  employee_id: string;
  week_start: string;
  summary: string;
  achievements: string | null;
  blockers: string | null;
  next_plan: string | null;
  video_url: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  review_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}
export interface EvaluationRow {
  id: string;
  employee_id: string;
  author_id: string;
  title: string;
  notes: string;
  score: number | null;
  visibility: 'employee' | 'admin';
  is_published: boolean;
  published_at: string | null;
  created_at: string;
}

export interface DashboardData {
  profiles: ProfileRow[];
  settings: SettingsRow;
  targets: TargetRow[];
  sessions: SessionRow[];
  tasks: TaskRow[];
  taskAssignees: TaskAssigneeRow[];
  reports: ReportRow[];
  evaluations: EvaluationRow[];
}

const defaults: SettingsRow = {
  workspace_name: 'Kultivate Digital ID',
  timezone: 'Asia/Jakarta',
  weekly_target_hours: 40,
  monthly_target_hours: 160,
  overall_target_hours: 600,
};

export async function loadDashboardData(context: Pick<APIContext, 'request' | 'cookies'>): Promise<DashboardData> {
  const supabase = createSupabaseServerClient(context);
  const [
    profilesResult,
    settingsResult,
    targetsResult,
    sessionsResult,
    tasksResult,
    assigneesResult,
    reportsResult,
    evaluationsResult,
  ] = await Promise.all([
    supabase.from('profiles').select('id,email,full_name,employee_code,role,is_active,portfolio_url,joined_at,first_login_verified_at').order('full_name'),
    supabase.from('workspace_settings').select('workspace_name,timezone,weekly_target_hours,monthly_target_hours,overall_target_hours').eq('id', true).maybeSingle(),
    supabase.from('targets').select('id,employee_id,target_type,target_hours,period_start,period_end,is_active').eq('is_active', true),
    supabase.from('work_sessions').select('id,employee_id,work_date,check_in,check_out,break_minutes,work_mode,activity_note,status,review_note').order('work_date', { ascending: false }).limit(500),
    supabase.from('tasks').select('id,title,project_description,how_to,success_criteria,created_by,priority,status,progress,due_date,progress_updated_by,progress_updated_at,created_at,updated_at').order('created_at', { ascending: false }).limit(500),
    supabase.from('task_assignees').select('task_id,employee_id,assigned_at').limit(2000),
    supabase.from('weekly_reports').select('id,employee_id,week_start,summary,achievements,blockers,next_plan,video_url,status,review_note,submitted_at,reviewed_at').order('week_start', { ascending: false }).limit(500),
    supabase.from('evaluations').select('id,employee_id,author_id,title,notes,score,visibility,is_published,published_at,created_at').order('created_at', { ascending: false }).limit(500),
  ]);

  const failed = [profilesResult, settingsResult, targetsResult, sessionsResult, tasksResult, assigneesResult, reportsResult, evaluationsResult]
    .find((result) => result.error);

  if (failed?.error) throw new Error(`DATABASE_READ_FAILED: ${failed.error.message}`);

  return {
    profiles: (profilesResult.data ?? []) as ProfileRow[],
    settings: (settingsResult.data as SettingsRow | null) ?? defaults,
    targets: (targetsResult.data ?? []) as TargetRow[],
    sessions: (sessionsResult.data ?? []) as SessionRow[],
    tasks: (tasksResult.data ?? []) as TaskRow[],
    taskAssignees: (assigneesResult.data ?? []) as TaskAssigneeRow[],
    reports: (reportsResult.data ?? []) as ReportRow[],
    evaluations: (evaluationsResult.data ?? []) as EvaluationRow[],
  };
}

export function taskEmployeeIds(data: Pick<DashboardData, 'taskAssignees'>, taskId: string): string[] {
  return data.taskAssignees.filter((row) => row.task_id === taskId).map((row) => row.employee_id);
}

export function toDashboardTask(task: TaskRow, data: Pick<DashboardData, 'profiles' | 'taskAssignees'>): DashboardTask {
  const employeeIds = taskEmployeeIds(data, task.id);
  const visibleNames = employeeIds
    .map((id) => data.profiles.find((profile) => profile.id === id)?.full_name)
    .filter((name): name is string => Boolean(name));
  const hiddenCount = Math.max(0, employeeIds.length - visibleNames.length);
  if (hiddenCount) visibleNames.push(`${hiddenCount} karyawan lain`);
  return {
    id: task.id,
    title: task.title,
    projectDescription: task.project_description,
    assignees: visibleNames.length ? visibleNames : ['Belum ditugaskan'],
    priority: task.priority,
    status: task.status,
    dueDate: task.due_date ?? '',
    progress: task.progress,
  };
}

export function employeeName(data: DashboardData, employeeId: string): string {
  return data.profiles.find((profile) => profile.id === employeeId)?.full_name ?? 'Karyawan';
}