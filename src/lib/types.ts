export type AppRole = 'admin' | 'employee';
export type WorkStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type TaskPriority = 'todo' | 'urgent';
export type TaskStatus = 'not_started' | 'in_progress' | 'completed';

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
  projectDescription: string;
  assignees: string[];
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  progress: number;
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