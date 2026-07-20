import type { AppUser, DashboardTask, EmployeeProgress } from './types';

export const employeeUser: AppUser = {
  id: '00000000-0000-0000-0000-000000000001',
  fullName: 'Joshua Wijaya',
  email: 'joshua@example.com',
  role: 'employee',
  employeeCode: 'EMP-001',
  avatar: 'JW',
};

export const adminUser: AppUser = {
  id: '00000000-0000-0000-0000-000000000004',
  fullName: 'Hans Galdino',
  email: 'hans@example.com',
  role: 'admin',
  avatar: 'HG',
};

export const employeeTasks: DashboardTask[] = [
  {
    id: 'orientasi-setup',
    title: 'Orientasi dan setup workspace',
    assignee: 'Joshua Wijaya',
    priority: 'high',
    status: 'in_progress',
    dueDate: '2026-07-23',
    progress: 72,
    checklistDone: 4,
    checklistTotal: 5,
  },
  {
    id: 'laporan-minggu-pertama',
    title: 'Laporan aktivitas minggu pertama',
    assignee: 'Joshua Wijaya',
    priority: 'medium',
    status: 'in_progress',
    dueDate: '2026-07-25',
    progress: 45,
    checklistDone: 2,
    checklistTotal: 5,
  },
  {
    id: 'materi-presentasi',
    title: 'Materi presentasi mingguan',
    assignee: 'Joshua Wijaya',
    priority: 'medium',
    status: 'not_started',
    dueDate: '2026-07-27',
    progress: 0,
    checklistDone: 0,
    checklistTotal: 5,
  },
];

export const teamProgress: EmployeeProgress[] = [
  {
    id: 'joshua',
    name: 'Joshua Wijaya',
    code: 'EMP-001',
    approvedHours: 284,
    targetHours: 600,
    weekHours: 31.5,
    attendanceStatus: 'checked_in',
  },
  {
    id: 'airin',
    name: 'Airin Frantrishia Lay',
    code: 'EMP-002',
    approvedHours: 312,
    targetHours: 600,
    weekHours: 34,
    attendanceStatus: 'completed',
  },
  {
    id: 'davis',
    name: 'Davis Ariel',
    code: 'EMP-003',
    approvedHours: 261,
    targetHours: 600,
    weekHours: 27.5,
    attendanceStatus: 'not_checked_in',
  },
];

export const recentActivity = [
  { person: 'Airin', action: 'mengirim laporan minggu ke-29', time: '10 menit lalu' },
  { person: 'Joshua', action: 'check-in dari kantor', time: '1 jam lalu' },
  { person: 'Hans', action: 'menyetujui 2 catatan absensi', time: '2 jam lalu' },
  { person: 'Davis', action: 'menambahkan bukti pekerjaan', time: 'kemarin' },
];
