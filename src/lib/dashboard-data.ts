import type { APIContext } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DashboardTask } from '@/lib/types';

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
  description: string | null;
  assignee_id: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'draft' | 'not_started' | 'in_progress' | 'in_review' | 'completed' | 'archived';
  start_date: string | null;
  due_date: string | null;
  estimate_hours: number | null;
  progress: number;
  created_at: string;
}
export interface ChecklistRow {
  id: string;
  task_id: string;
  title: string;
  position: number;
  is_done: boolean;
}
export interface TaskUpdateRow {
  id: string;
  task_id: string;
  employee_id: string;
  progress: number;
  note: string | null;
  work_url: string | null;
  evidence_path: string | null;
  created_at: string;
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
export interface AllowanceRow {
  id: string;
  employee_id: string;
  expense_date: string;
  transport_amount: number;
  meal_amount: number;
  notes: string | null;
  receipt_path: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  review_note: string | null;
  submitted_at: string | null;
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
  checklist: ChecklistRow[];
  taskUpdates: TaskUpdateRow[];
  reports: ReportRow[];
  allowances: AllowanceRow[];
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
    checklistResult,
    updatesResult,
    reportsResult,
    allowancesResult,
    evaluationsResult,
  ] = await Promise.all([
    supabase.from('profiles').select('id,email,full_name,employee_code,role,is_active,portfolio_url,joined_at,first_login_verified_at').order('full_name'),
    supabase.from('workspace_settings').select('workspace_name,timezone,weekly_target_hours,monthly_target_hours,overall_target_hours').eq('id', true).maybeSingle(),
    supabase.from('targets').select('id,employee_id,target_type,target_hours,period_start,period_end,is_active').eq('is_active', true),
    supabase.from('work_sessions').select('id,employee_id,work_date,check_in,check_out,break_minutes,work_mode,activity_note,status,review_note').order('work_date', { ascending: false }).limit(500),
    supabase.from('tasks').select('id,title,description,assignee_id,priority,status,start_date,due_date,estimate_hours,progress,created_at').order('due_date', { ascending: true }).limit(500),
    supabase.from('task_checklist').select('id,task_id,title,position,is_done').order('position'),
    supabase.from('task_updates').select('id,task_id,employee_id,progress,note,work_url,evidence_path,created_at').order('created_at', { ascending: false }).limit(500),
    supabase.from('weekly_reports').select('id,employee_id,week_start,summary,achievements,blockers,next_plan,video_url,status,review_note,submitted_at,reviewed_at').order('week_start', { ascending: false }).limit(500),
    supabase.from('allowances').select('id,employee_id,expense_date,transport_amount,meal_amount,notes,receipt_path,status,review_note,submitted_at').order('expense_date', { ascending: false }).limit(500),
    supabase.from('evaluations').select('id,employee_id,author_id,title,notes,score,visibility,is_published,published_at,created_at').order('created_at', { ascending: false }).limit(500),
  ]);

  const failed = [
    profilesResult,
    settingsResult,
    targetsResult,
    sessionsResult,
    tasksResult,
    checklistResult,
    updatesResult,
    reportsResult,
    allowancesResult,
    evaluationsResult,
  ].find((result) => result.error);

  if (failed?.error) {
    throw new Error(`DATABASE_READ_FAILED: ${failed.error.message}`);
  }

  return {
    profiles: (profilesResult.data ?? []) as ProfileRow[],
    settings: (settingsResult.data as SettingsRow | null) ?? defaults,
    targets: (targetsResult.data ?? []) as TargetRow[],
    sessions: (sessionsResult.data ?? []) as SessionRow[],
    tasks: (tasksResult.data ?? []) as TaskRow[],
    checklist: (checklistResult.data ?? []) as ChecklistRow[],
    taskUpdates: (updatesResult.data ?? []) as TaskUpdateRow[],
    reports: (reportsResult.data ?? []) as ReportRow[],
    allowances: (allowancesResult.data ?? []) as AllowanceRow[],
    evaluations: (evaluationsResult.data ?? []) as EvaluationRow[],
  };
}

export function toDashboardTask(task: TaskRow, data: Pick<DashboardData, 'profiles' | 'checklist'>): DashboardTask {
  const assignee = data.profiles.find((profile) => profile.id === task.assignee_id);
  const items = data.checklist.filter((item) => item.task_id === task.id);
  return {
    id: task.id,
    title: task.title,
    assignee: assignee?.full_name ?? 'Karyawan',
    priority: task.priority,
    status: task.status === 'draft' || task.status === 'archived' ? 'not_started' : task.status,
    dueDate: task.due_date ?? '',
    progress: task.progress,
    checklistDone: items.filter((item) => item.is_done).length,
    checklistTotal: items.length,
  };
}

export function employeeName(data: DashboardData, employeeId: string): string {
  return data.profiles.find((profile) => profile.id === employeeId)?.full_name ?? 'Karyawan';
}

export async function createEvidenceUrl(
  context: Pick<APIContext, 'request' | 'cookies'>,
  path: string,
): Promise<string | null> {
  const supabase = createSupabaseServerClient(context);
  const { data, error } = await supabase.storage.from('work-evidence').createSignedUrl(path, 300);
  return error ? null : data.signedUrl;
}
