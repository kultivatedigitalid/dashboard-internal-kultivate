import type { APIRoute } from 'astro';
import { createSupabaseServerClient, hasSupabaseConfig } from '@/lib/supabase/server';

export const GET: APIRoute = async (context) => {
  const code = context.url.searchParams.get('code');
  if (!code || !hasSupabaseConfig()) return context.redirect('/login');
  const supabase = createSupabaseServerClient(context);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return context.redirect('/login?error=callback');
  return context.redirect(data.user.app_metadata.app_role === 'admin' ? '/admin' : '/app');
};
