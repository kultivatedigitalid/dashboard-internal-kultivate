import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { createSupabaseServerClient, hasSupabaseConfig } from '@/lib/supabase/server';

function requireConfigured() {
  if (!hasSupabaseConfig()) {
    throw new ActionError({
      code: 'PRECONDITION_FAILED',
      message: 'Supabase belum dikonfigurasi. Gunakan mode demo lokal atau isi .env.local.',
    });
  }
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
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'Email atau password tidak sesuai.',
        });
      }

      const role = data.user.app_metadata.app_role === 'admin' ? 'admin' : 'employee';
      return { redirectTo: role === 'admin' ? '/admin' : '/app' };
    },
  }),

  logout: defineAction({
    accept: 'form',
    handler: async (_, context) => {
      if (hasSupabaseConfig()) {
        const supabase = createSupabaseServerClient(context);
        await supabase.auth.signOut();
      }
      context.cookies.delete('demo-role', { path: '/' });
      return { redirectTo: '/login' };
    },
  }),

  checkIn: defineAction({
    accept: 'form',
    input: z.object({
      workMode: z.enum(['office', 'remote']),
      notes: z.string().max(1000).optional(),
    }),
    handler: async ({ workMode, notes }, context) => {
      if (context.locals.isDemo) {
        return { message: 'Check-in demo tercatat pada 08.03 WIB.' };
      }

      requireConfigured();
      if (!context.locals.user || context.locals.role !== 'employee') {
        throw new ActionError({ code: 'FORBIDDEN', message: 'Anda tidak memiliki akses.' });
      }

      const supabase = createSupabaseServerClient(context);
      const { error } = await supabase.from('work_sessions').insert({
        employee_id: context.locals.user.id,
        work_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
        check_in: new Date().toISOString(),
        work_mode: workMode,
        activity_note: notes ?? null,
        status: 'draft',
      });

      if (error) {
        throw new ActionError({ code: 'CONFLICT', message: 'Check-in hari ini sudah tercatat.' });
      }

      return { message: 'Check-in berhasil dicatat.' };
    },
  }),

  saveWeeklyReport: defineAction({
    accept: 'form',
    input: z.object({
      summary: z.string().max(5000),
      achievements: z.string().max(5000).optional(),
      blockers: z.string().max(5000).optional(),
      nextPlan: z.string().max(5000).optional(),
      videoUrl: z.union([z.literal(''), z.string().url('Masukkan URL video yang valid.')]),
      intent: z.enum(['draft', 'submit']),
    }),
    handler: async (input, context) => {
      if (input.intent === 'submit' && input.summary.trim().length < 3) {
        throw new ActionError({ code: 'BAD_REQUEST', message: 'Ringkasan wajib sebelum dikirim.' });
      }
      if (context.locals.isDemo) {
        return { message: input.intent === 'draft' ? 'Draft demo disimpan.' : 'Laporan demo dikirim.' };
      }
      requireConfigured();
      throw new ActionError({
        code: 'NOT_IMPLEMENTED',
        message: 'Hubungkan proyek Supabase dan jalankan migration sebelum menyimpan laporan.',
      });
    },
  }),
};
