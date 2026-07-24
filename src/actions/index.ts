import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import {
  createSupabaseOtpVerifier,
  createSupabaseServerClient,
  createSupabaseServiceClient,
  getPublicSiteUrl,
  hasSupabaseConfig,
  hasSupabaseSecret,
} from '@/lib/supabase/server';
import { currentWeekStart } from '@/lib/dates';

const optionalDate = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);
const optionalUrl = z.union([z.literal(''), z.string().url('Masukkan URL yang valid.')]);

const taskFields = {
  title: z.string().trim().min(3, 'Task Name wajib diisi minimal 3 karakter.').max(240, 'Task Name maksimal 240 karakter.'),
  projectDescription: z.string().trim().min(3, 'Project Description wajib diisi minimal 3 karakter.').max(5000, 'Project Description maksimal 5000 karakter.'),
  howTo: z.string().trim().max(5000, 'Detail How-to maksimal 5000 karakter.').optional(),
  successCriteria: z.string().trim().max(5000, 'Success Criteria maksimal 5000 karakter.').optional(),
  assigneeIds: z.array(z.string().uuid()).min(1, 'Pilih minimal satu karyawan yang mengerjakan.'),
  priority: z.enum(['todo', 'urgent']),
  deadlineMode: z.enum(['dated', 'none']),
  dueDate: optionalDate.optional(),
};

const validateDeadline = (input: { deadlineMode: 'dated' | 'none'; dueDate?: string | undefined }, context: z.RefinementCtx) => {
  if (input.deadlineMode === 'dated' && !input.dueDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['dueDate'], message: 'Pilih tanggal deadline atau pilih No Deadline.' });
  }
};

const createTaskSchema = z.object(taskFields).superRefine(validateDeadline);
const updateTaskSchema = z.object({
  ...taskFields,
  taskId: z.string().uuid(),
  progress: z.coerce.number().int().min(0, 'Progress minimal 0%.').max(100, 'Progress maksimal 100%.'),
}).superRefine(validateDeadline);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password lama wajib diisi.'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter.').max(72, 'Password baru maksimal 72 karakter.'),
  confirmPassword: z.string().min(1, 'Konfirmasi password baru wajib diisi.'),
}).superRefine((input, context) => {
  if (input.newPassword === input.currentPassword) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['newPassword'], message: 'Password baru harus berbeda dari password lama.' });
  }
  if (input.newPassword !== input.confirmPassword) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Konfirmasi password baru tidak sama.' });
  }
});

function requireConfigured() {
  if (!hasSupabaseConfig()) {
    throw new ActionError({ code: 'PRECONDITION_FAILED', message: 'Supabase belum dikonfigurasi.' });
  }
}

function requireUser(context: Parameters<Parameters<typeof defineAction>[0]['handler']>[1], role?: 'admin' | 'employee') {
  if (!context.locals.user) {
    throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sesi berakhir. Silakan masuk kembali.' });
  }
  if (role && context.locals.role !== role) {
    throw new ActionError({ code: 'FORBIDDEN', message: 'Anda tidak memiliki akses untuk tindakan ini.' });
  }
  return context.locals.user;
}

function dbError(error: { message: string } | null, fallback: string): never {
  const message = error?.message ?? '';
  const known: Record<string, string> = {
    ALREADY_CHECKED_IN: 'Check-in hari ini sudah tercatat.',
    NO_OPEN_SESSION: 'Tidak ada sesi kerja aktif untuk di-check-out.',
    REPORT_LOCKED: 'Laporan yang sudah dikirim tidak dapat diubah sebelum ditolak admin.',
    SUMMARY_REQUIRED: 'Ringkasan wajib diisi sebelum laporan dikirim.',
    TASK_NOT_EDITABLE: 'Tugas ini tidak dapat diperbarui.',
    TASK_NOT_FOUND: 'Tugas tidak ditemukan.',
    TASK_NAME_REQUIRED: 'Task Name minimal 3 karakter.',
    PROJECT_DESCRIPTION_REQUIRED: 'Project Description minimal 3 karakter.',
    ASSIGNEE_REQUIRED: 'Pilih minimal satu karyawan.',
    INVALID_ASSIGNEE: 'Salah satu karyawan tidak valid atau tidak aktif.',
    INVALID_PRIORITY: 'Priority hanya dapat dipilih antara Urgent dan To-do.',
    INVALID_PROGRESS: 'Progress harus berada antara 0 sampai 100.',
    REVIEW_NOTE_REQUIRED: 'Catatan review wajib diisi ketika menolak.',
    SESSION_NOT_REVIEWABLE: 'Absensi ini sudah direview atau belum dikirim.',
    REPORT_NOT_REVIEWABLE: 'Laporan ini sudah direview atau belum dikirim.',
    OTP_RESEND_WAIT: 'Kode baru dapat dikirim setelah 60 detik.',
    OTP_NOT_REQUESTED: 'Belum ada kode OTP aktif. Kirim ulang kode terlebih dahulu.',
    OTP_EXPIRED: 'Kode OTP sudah kedaluwarsa. Kirim ulang untuk mendapatkan kode baru.',
    OTP_ATTEMPTS_EXCEEDED: 'Batas 5 percobaan tercapai. Kirim ulang untuk mendapatkan kode baru.',
    OTP_NOT_REQUIRED: 'Sesi ini sudah berhasil diverifikasi.',
    OTP_CHALLENGE_INVALID: 'Sesi OTP tidak valid atau sudah kedaluwarsa. Silakan login kembali.',
  };
  const match = Object.entries(known).find(([code]) => message.includes(code));
  throw new ActionError({ code: 'BAD_REQUEST', message: match?.[1] ?? fallback });
}

export const server = {
  login: defineAction({
    accept: 'form',
    input: z.object({
      email: z.string().email('Masukkan email yang valid.'),
      password: z.string().min(8, 'Password minimal 8 karakter.'),
    }),
    handler: async ({ email, password }, context) => {
      requireConfigured();
      const supabase = createSupabaseServerClient(context);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        throw new ActionError({ code: 'UNAUTHORIZED', message: 'Email atau password tidak sesuai.' });
      }

      const role = data.user.app_metadata.app_role === 'admin' ? 'admin' : 'employee';
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active, role, first_login_verified_at')
        .eq('id', data.user.id)
        .maybeSingle();
      if (!profile || !profile.is_active || profile.role !== role) {
        await supabase.auth.signOut();
        throw new ActionError({
          code: 'FORBIDDEN',
          message: 'Akun tidak aktif atau profil belum tersinkron. Hubungi administrator.',
        });
      }

      const { error: challengeError } = await supabase.rpc('begin_login_otp');
      if (challengeError && !challengeError.message.includes('OTP_RESEND_WAIT')) {
        await supabase.auth.signOut({ scope: 'local' });
        dbError(challengeError, 'Verifikasi OTP tidak dapat dimulai.');
      }

      if (!challengeError) {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: data.user.email ?? email,
          options: { shouldCreateUser: false },
        });
        if (otpError) {
          await supabase.rpc('cancel_login_otp');
          await supabase.auth.signOut({ scope: 'local' });
          throw new ActionError({ code: 'BAD_REQUEST', message: 'Kode OTP tidak dapat dikirim. Periksa konfigurasi SMTP.' });
        }
      }

      return { redirectTo: '/verify-otp?sent=1' };
    },
  }),

  verifyLoginOtp: defineAction({
    accept: 'form',
    input: z.object({ code: z.string().regex(/^\d{6}$/, 'Masukkan kode OTP 6 digit.') }),
    handler: async ({ code }, context) => {
      requireConfigured();
      const user = requireUser(context);
      if (!hasSupabaseSecret()) {
        throw new ActionError({ code: 'PRECONDITION_FAILED', message: 'SUPABASE_SECRET_KEY wajib untuk menyelesaikan verifikasi OTP.' });
      }

      const supabase = createSupabaseServerClient(context);
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
      const sessionId = claimsData?.claims.session_id;
      if (claimsError || typeof sessionId !== 'string') {
        throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sesi tidak valid. Silakan login kembali.' });
      }

      const { data: remainingData, error: attemptError } = await supabase.rpc('consume_login_otp_attempt');
      if (attemptError) dbError(attemptError, 'Kode OTP tidak dapat diverifikasi.');
      const remaining = Number(remainingData ?? 0);

      const otpVerifier = createSupabaseOtpVerifier();
      const { data, error } = await otpVerifier.auth.verifyOtp({
        email: user.email,
        token: code,
        type: 'email',
      });
      if (error || !data.user || data.user.id !== user.id) {
        if (data.session) await otpVerifier.auth.signOut({ scope: 'local' });
        throw new ActionError({
          code: 'BAD_REQUEST',
          message: remaining > 0
            ? 'Kode OTP tidak valid. Tersisa ' + remaining + ' percobaan.'
            : 'Kode OTP tidak valid. Kirim ulang untuk mencoba lagi.',
        });
      }

      try {
        const service = createSupabaseServiceClient();
        const { error: completionError } = await service.rpc('complete_login_otp', {
          p_user_id: user.id,
          p_session_id: sessionId,
        });
        if (completionError) dbError(completionError, 'Status verifikasi sesi tidak dapat disimpan.');
      } finally {
        await otpVerifier.auth.signOut({ scope: 'local' });
      }

      return { redirectTo: context.locals.role === 'admin' ? '/admin' : '/app' };
    },
  }),

  resendLoginOtp: defineAction({
    accept: 'form',
    handler: async (_, context) => {
      requireConfigured();
      const user = requireUser(context);
      const supabase = createSupabaseServerClient(context);
      const { error: challengeError } = await supabase.rpc('begin_login_otp');
      if (challengeError) dbError(challengeError, 'Kode OTP baru tidak dapat disiapkan.');
      const { error } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: { shouldCreateUser: false },
      });
      if (error) {
        await supabase.rpc('cancel_login_otp');
        throw new ActionError({ code: 'BAD_REQUEST', message: 'Kode OTP tidak dapat dikirim. Periksa konfigurasi SMTP.' });
      }
      return { message: 'Kode OTP baru telah dikirim. Kode berlaku selama 10 menit.' };
    },
  }),

  logout: defineAction({
    accept: 'form',
    handler: async (_, context) => {
      if (hasSupabaseConfig()) {
        const supabase = createSupabaseServerClient(context);
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Gagal mengakhiri sesi.' });
      }
      return { redirectTo: '/login' };
    },
  }),

  requestPasswordReset: defineAction({
    accept: 'form',
    input: z.object({ email: z.string().email('Masukkan email yang valid.') }),
    handler: async ({ email }, context) => {
      requireConfigured();
      const supabase = createSupabaseServerClient(context);
      const siteUrl = getPublicSiteUrl() ?? new URL(context.request.url).origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
      });
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: 'Tautan pemulihan tidak dapat dikirim. Coba lagi.' });
      return { message: 'Jika email terdaftar, tautan pemulihan telah dikirim.' };
    },
  }),

  resetPassword: defineAction({
    accept: 'form',
    input: z.object({
      password: z.string().min(8, 'Password minimal 8 karakter.'),
      confirmPassword: z.string().min(8),
    }).refine((value) => value.password === value.confirmPassword, {
      message: 'Konfirmasi password tidak sama.',
      path: ['confirmPassword'],
    }),
    handler: async ({ password }, context) => {
      requireConfigured();
      const supabase = createSupabaseServerClient(context);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ActionError({ code: 'UNAUTHORIZED', message: 'Tautan pemulihan sudah kedaluwarsa. Minta tautan baru.' });
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: 'Password tidak dapat diperbarui.' });
      await supabase.auth.signOut();
      return { redirectTo: '/login?password=updated' };
    },
  }),

  checkIn: defineAction({
    accept: 'form',
    input: z.object({
      workMode: z.enum(['office', 'remote']),
      notes: z.string().max(1000).optional(),
    }),
    handler: async ({ workMode, notes }, context) => {
      requireConfigured();
      requireUser(context, 'employee');
      const supabase = createSupabaseServerClient(context);
      const { error } = await supabase.rpc('check_in', { p_work_mode: workMode, p_activity_note: notes ?? null });
      if (error) dbError(error, 'Check-in gagal dicatat.');
      return { message: 'Check-in berhasil dicatat.' };
    },
  }),

  checkOut: defineAction({
    accept: 'form',
    input: z.object({
      breakMinutes: z.coerce.number().int().min(0).max(1440),
      notes: z.string().max(1000).optional(),
    }),
    handler: async ({ breakMinutes, notes }, context) => {
      requireConfigured();
      requireUser(context, 'employee');
      const supabase = createSupabaseServerClient(context);
      const { error } = await supabase.rpc('check_out', { p_break_minutes: breakMinutes, p_activity_note: notes ?? null });
      if (error) dbError(error, 'Check-out gagal dicatat.');
      return { message: 'Check-out berhasil. Absensi dikirim untuk direview.' };
    },
  }),

  saveWeeklyReport: defineAction({
    accept: 'form',
    input: z.object({
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(currentWeekStart()),
      summary: z.string().max(5000),
      achievements: z.string().max(5000).optional(),
      blockers: z.string().max(5000).optional(),
      nextPlan: z.string().max(5000).optional(),
      videoUrl: optionalUrl,
      intent: z.enum(['draft', 'submit']),
    }),
    handler: async (input, context) => {
      requireConfigured();
      requireUser(context, 'employee');
      const supabase = createSupabaseServerClient(context);
      const { error } = await supabase.rpc('save_weekly_report', {
        p_week_start: input.weekStart,
        p_summary: input.summary,
        p_achievements: input.achievements ?? '',
        p_blockers: input.blockers ?? '',
        p_next_plan: input.nextPlan ?? '',
        p_video_url: input.videoUrl,
        p_status: input.intent === 'submit' ? 'submitted' : 'draft',
      });
      if (error) dbError(error, 'Laporan tidak dapat disimpan.');
      return { message: input.intent === 'draft' ? 'Draft laporan disimpan.' : 'Laporan dikirim untuk direview.' };
    },
  }),

  changePassword: defineAction({
    accept: 'form',
    input: changePasswordSchema,
    handler: async (input, context) => {
      requireConfigured();
      const user = requireUser(context);
      const verifier = createSupabaseOtpVerifier();
      try {
        const { data, error } = await verifier.auth.signInWithPassword({
          email: user.email,
          password: input.currentPassword,
        });
        if (error || data.user?.id !== user.id) {
          return { success: false as const, field: 'currentPassword' as const, message: 'Password lama tidak sesuai.' };
        }
      } finally {
        await verifier.auth.signOut({ scope: 'local' });
      }

      const supabase = createSupabaseServerClient(context);
      const { error } = await supabase.auth.updateUser({ password: input.newPassword });
      if (error) {
        throw new ActionError({ code: 'BAD_REQUEST', message: 'Password baru tidak dapat disimpan. Periksa ketentuan password lalu coba lagi.' });
      }
      return { success: true as const, message: 'Password berhasil diperbarui.' };
    },
  }),

  updateProfile: defineAction({
    accept: 'form',
    input: z.object({ portfolioUrl: optionalUrl }),
    handler: async ({ portfolioUrl }, context) => {
      requireConfigured();
      requireUser(context, 'employee');
      const supabase = createSupabaseServerClient(context);
      const { error } = await supabase.rpc('update_my_profile', { p_portfolio_url: portfolioUrl });
      if (error) dbError(error, 'Profil tidak dapat diperbarui.');
      return { message: 'Profil berhasil diperbarui.' };
    },
  }),

  updateTaskProgress: defineAction({
    accept: 'form',
    input: z.object({
      taskId: z.string().uuid(),
      progress: z.coerce.number().int().min(0).max(100),
    }),
    handler: async ({ taskId, progress }, context) => {
      requireConfigured();
      requireUser(context, 'employee');
      const supabase = createSupabaseServerClient(context);
      const { error } = await supabase.rpc('update_task_progress', {
        p_task_id: taskId,
        p_progress: progress,
      });
      if (error) dbError(error, 'Progress tugas tidak dapat disimpan.');
      return { redirectTo: '/app/tasks?updated=success' };
    },
  }),

  createTask: defineAction({
    accept: 'form',
    input: createTaskSchema,
    handler: async (input, context) => {
      requireConfigured();
      requireUser(context, 'admin');
      const dueDate = input.deadlineMode === 'none' ? null : input.dueDate || null;
      const supabase = createSupabaseServerClient(context);
      const { error } = await supabase.rpc('admin_create_task', {
        p_title: input.title,
        p_project_description: input.projectDescription,
        p_how_to: input.howTo || null,
        p_success_criteria: input.successCriteria || null,
        p_assignee_ids: input.assigneeIds,
        p_priority: input.priority,
        p_due_date: dueDate,
      });
      if (error) dbError(error, 'Tugas tidak dapat dibuat.');
      return { redirectTo: '/admin/tasks?created=success' };
    },
  }),

  updateTask: defineAction({
    accept: 'form',
    input: updateTaskSchema,
    handler: async (input, context) => {
      requireConfigured();
      requireUser(context, 'admin');
      const dueDate = input.deadlineMode === 'none' ? null : input.dueDate || null;
      const supabase = createSupabaseServerClient(context);
      const { error } = await supabase.rpc('admin_update_task', {
        p_id: input.taskId,
        p_title: input.title,
        p_project_description: input.projectDescription,
        p_how_to: input.howTo || null,
        p_success_criteria: input.successCriteria || null,
        p_assignee_ids: input.assigneeIds,
        p_priority: input.priority,
        p_progress: input.progress,
        p_due_date: dueDate,
      });
      if (error) dbError(error, 'Tugas tidak dapat diperbarui.');
      return { message: 'Perubahan tugas berhasil disimpan.' };
    },
  }),

  deleteTask: defineAction({
    accept: 'form',
    input: z.object({ taskId: z.string().uuid() }),
    handler: async ({ taskId }, context) => {
      requireConfigured();
      requireUser(context, 'admin');
      const supabase = createSupabaseServerClient(context);
      const { error } = await supabase.rpc('admin_delete_task', { p_id: taskId });
      if (error) dbError(error, 'Tugas tidak dapat dihapus.');
      return { redirectTo: '/admin/tasks?deleted=success' };
    },
  }),
  reviewAttendance: defineAction({
    accept: 'form',
    input: z.object({ sessionId: z.string().uuid(), decision: z.enum(['approved', 'rejected']), reviewNote: z.string().max(3000).optional() }),
    handler: async (input, context) => {
      requireConfigured();
      requireUser(context, 'admin');
      const supabase = createSupabaseServerClient(context);
      const { error } = await supabase.rpc('admin_review_work_session', {
        p_id: input.sessionId, p_decision: input.decision, p_review_note: input.reviewNote ?? '',
      });
      if (error) dbError(error, 'Review absensi gagal disimpan.');
      return { message: input.decision === 'approved' ? 'Absensi disetujui.' : 'Absensi ditolak.' };
    },
  }),

  reviewReport: defineAction({
    accept: 'form',
    input: z.object({ reportId: z.string().uuid(), decision: z.enum(['approved', 'rejected']), reviewNote: z.string().max(3000).optional() }),
    handler: async (input, context) => {
      requireConfigured();
      requireUser(context, 'admin');
      const supabase = createSupabaseServerClient(context);
      const { error } = await supabase.rpc('admin_review_weekly_report', {
        p_id: input.reportId, p_decision: input.decision, p_review_note: input.reviewNote ?? '',
      });
      if (error) dbError(error, 'Review laporan gagal disimpan.');
      return { message: input.decision === 'approved' ? 'Laporan ditandai reviewed.' : 'Revisi diminta.' };
    },
  }),

  upsertTarget: defineAction({
    accept: 'form',
    input: z.object({
      employeeId: z.string().uuid(),
      targetType: z.enum(['overall', 'weekly', 'monthly']),
      targetHours: z.coerce.number().min(0),
      periodStart: optionalDate,
      periodEnd: optionalDate,
    }),
    handler: async (input, context) => {
      requireConfigured();
      requireUser(context, 'admin');
      const supabase = createSupabaseServerClient(context);
      const { error } = await supabase.rpc('admin_upsert_target', {
        p_employee_id: input.employeeId,
        p_target_type: input.targetType,
        p_target_hours: input.targetHours,
        p_period_start: input.periodStart || null,
        p_period_end: input.periodEnd || null,
      });
      if (error) dbError(error, 'Target tidak dapat disimpan.');
      return { message: 'Target berhasil disimpan.' };
    },
  }),

  createEvaluation: defineAction({
    accept: 'form',
    input: z.object({
      employeeId: z.string().uuid(),
      title: z.string().min(3).max(240),
      notes: z.string().min(3).max(5000),
      score: z.union([z.literal(''), z.coerce.number().int().min(1).max(5)]),
      visibility: z.enum(['employee', 'admin']),
      intent: z.enum(['draft', 'publish']),
    }),
    handler: async (input, context) => {
      requireConfigured();
      requireUser(context, 'admin');
      const supabase = createSupabaseServerClient(context);
      const { error } = await supabase.rpc('admin_create_evaluation', {
        p_employee_id: input.employeeId,
        p_title: input.title,
        p_notes: input.notes,
        p_score: input.score === '' ? null : input.score,
        p_visibility: input.visibility,
        p_publish: input.intent === 'publish',
      });
      if (error) dbError(error, 'Evaluasi tidak dapat disimpan.');
      return { message: input.intent === 'publish' ? 'Evaluasi dipublikasikan.' : 'Draft evaluasi disimpan.' };
    },
  }),

  updateWorkspaceSettings: defineAction({
    accept: 'form',
    input: z.object({
      workspaceName: z.string().min(2).max(100),
      timezone: z.literal('Asia/Jakarta'),
      weeklyTarget: z.coerce.number().min(0),
      monthlyTarget: z.coerce.number().min(0),
      overallTarget: z.coerce.number().min(0),
    }),
    handler: async (input, context) => {
      requireConfigured();
      requireUser(context, 'admin');
      const supabase = createSupabaseServerClient(context);
      const { error } = await supabase.rpc('admin_update_workspace_settings', {
        p_workspace_name: input.workspaceName,
        p_timezone: input.timezone,
        p_weekly: input.weeklyTarget,
        p_monthly: input.monthlyTarget,
        p_overall: input.overallTarget,
      });
      if (error) dbError(error, 'Pengaturan tidak dapat disimpan.');
      return { message: 'Pengaturan workspace disimpan.' };
    },
  }),

  createEmployee: defineAction({
    accept: 'form',
    input: z.object({
      fullName: z.string().trim().min(2, 'Nama wajib diisi minimal 2 karakter.').max(120, 'Nama maksimal 120 karakter.'),
      email: z.string().trim().toLowerCase().email('Masukkan alamat Gmail yang valid.').refine(
        (value) => /^[a-z0-9._%+-]+@gmail\.com$/i.test(value),
        'Alamat email harus menggunakan Gmail.',
      ),
    }),
    handler: async (input, context) => {
      requireConfigured();
      requireUser(context, 'admin');
      if (!hasSupabaseSecret()) {
        throw new ActionError({ code: 'PRECONDITION_FAILED', message: 'SUPABASE_SECRET_KEY wajib untuk menambahkan karyawan.' });
      }
      const service = createSupabaseServiceClient();
      const { data: duplicate, error: duplicateError } = await service
        .from('profiles')
        .select('id')
        .ilike('email', input.email)
        .maybeSingle();
      if (duplicateError) dbError(duplicateError, 'Email karyawan tidak dapat diperiksa.');
      if (duplicate) {
        throw new ActionError({ code: 'CONFLICT', message: 'Gmail tersebut sudah digunakan oleh akun lain.' });
      }

      const firstName = (input.fullName.split(/\s+/)[0] ?? '').toLowerCase().replace(/\s+/g, '');
      const password = `password123${firstName}`;
      const { data, error } = await service.auth.admin.createUser({
        email: input.email,
        password,
        email_confirm: true,
        app_metadata: { app_role: 'employee' },
        user_metadata: { full_name: input.fullName },
      });
      if (error || !data.user) {
        const exists = error?.message?.toLowerCase().includes('already') ?? false;
        throw new ActionError({
          code: exists ? 'CONFLICT' : 'BAD_REQUEST',
          message: exists ? 'Gmail tersebut sudah digunakan oleh akun lain.' : 'Akun Supabase Auth karyawan tidak dapat dibuat.',
        });
      }

      const { error: profileError } = await service.from('profiles').upsert({
        id: data.user.id,
        email: input.email,
        full_name: input.fullName,
        employee_code: null,
        role: 'employee',
        is_active: true,
        first_login_verified_at: null,
      }, { onConflict: 'id' });
      if (profileError) {
        const { error: rollbackError } = await service.auth.admin.deleteUser(data.user.id);
        throw new ActionError({
          code: 'BAD_REQUEST',
          message: rollbackError
            ? 'Profil karyawan gagal disimpan dan akun Auth perlu dihapus secara manual. Tidak ada karyawan yang dapat digunakan sebelum masalah ini diselesaikan.'
            : 'Profil karyawan gagal disimpan. Pembuatan akun dibatalkan dan perubahan telah di-roll back.',
        });
      }

      return {
        message: `Karyawan ${input.fullName} berhasil ditambahkan. Password awal: ${password}. Karyawan ini langsung tersedia sebagai penerima tugas.`,
      };
    },
  }),
  createAdmin: defineAction({
    accept: 'form',
    input: z.object({
      fullName: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(120),
      email: z.string().trim().email('Masukkan email yang valid.').refine(
        (value) => /^[a-z0-9._%+-]+@gmail\.com$/i.test(value),
        'Alamat admin harus menggunakan Gmail.',
      ),
      confirmation: z.literal('confirmed'),
    }),
    handler: async (input, context) => {
      requireConfigured();
      requireUser(context, 'admin');
      if (!hasSupabaseSecret()) {
        throw new ActionError({ code: 'PRECONDITION_FAILED', message: 'SUPABASE_SECRET_KEY wajib untuk membuat admin.' });
      }
      const service = createSupabaseServiceClient();
      const email = input.email.toLowerCase();
      const { data: duplicate, error: duplicateError } = await service
        .from('profiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle();
      if (duplicateError) dbError(duplicateError, 'Email tidak dapat diperiksa.');
      if (duplicate) {
        throw new ActionError({ code: 'CONFLICT', message: 'Email tersebut sudah digunakan oleh akun lain.' });
      }

      const siteUrl = getPublicSiteUrl() ?? new URL(context.request.url).origin;
      const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
        data: { full_name: input.fullName },
      });
      if (error || !data.user) {
        const exists = error?.message?.toLowerCase().includes('already') ?? false;
        throw new ActionError({
          code: exists ? 'CONFLICT' : 'BAD_REQUEST',
          message: exists ? 'Email tersebut sudah digunakan oleh akun lain.' : 'Undangan admin tidak dapat dikirim.',
        });
      }

      const { error: authError } = await service.auth.admin.updateUserById(data.user.id, {
        app_metadata: { app_role: 'admin' },
        user_metadata: { full_name: input.fullName },
      });
      if (authError) dbError(authError, 'Role autentikasi admin tidak dapat ditetapkan.');
      const { error: profileError } = await service.from('profiles').update({
        email,
        full_name: input.fullName,
        role: 'admin',
        is_active: true,
        first_login_verified_at: null,
      }).eq('id', data.user.id);
      if (profileError) dbError(profileError, 'Profil admin tidak dapat disimpan.');
      return { message: `Undangan admin dikirim ke ${email}.` };
    },
  }),

  setEmployeeActive: defineAction({
    accept: 'form',
    input: z.object({ employeeId: z.string().uuid(), active: z.enum(['true', 'false']) }),
    handler: async ({ employeeId, active }, context) => {
      requireConfigured();
      requireUser(context, 'admin');
      if (!hasSupabaseSecret()) {
        throw new ActionError({ code: 'PRECONDITION_FAILED', message: 'SUPABASE_SECRET_KEY wajib untuk mengelola akun.' });
      }
      const service = createSupabaseServiceClient();
      const { error } = await service.from('profiles').update({ is_active: active === 'true' }).eq('id', employeeId).eq('role', 'employee');
      if (error) dbError(error, 'Status akun tidak dapat diperbarui.');
      return { message: active === 'true' ? 'Akun diaktifkan.' : 'Akun dinonaktifkan.' };
    },
  }),
};
