import type { APIRoute } from 'astro';
import { createSupabaseServerClient, hasSupabaseConfig } from '@/lib/supabase/server';

export const GET: APIRoute = async (context) => {
  const code = context.url.searchParams.get('code');
  const requestedNext = context.url.searchParams.get('next');
  const next = requestedNext === '/reset-password' ? requestedNext : null;
  if (!code || !hasSupabaseConfig()) return context.redirect('/login?error=callback');

  const supabase = createSupabaseServerClient(context);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return context.redirect('/login?error=callback');
  if (next) return context.redirect(next);
  return context.redirect(data.user.app_metadata.app_role === 'admin' ? '/admin' : '/app');
};
