export type AppRole = 'admin' | 'employee';
export type WorkStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type TaskStatus = 'not_started' | 'in_progress' | 'in_review' | 'completed';

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  employeeCode?: string;
  avatar: string;
}

export interface DashboardTask {
  id: string;
  title: string;
  assignee: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: TaskStatus;
  dueDate: string;
  progress: number;
  checklistDone: number;
  checklistTotal: number;
}

export interface EmployeeProgress {
  id: string;
  name: string;
  code: string;
  approvedHours: number;
  targetHours: number;
  weekHours: number;
  attendanceStatus: 'checked_in' | 'not_checked_in' | 'completed';
}
