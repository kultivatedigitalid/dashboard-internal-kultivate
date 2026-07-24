import type { APIRoute } from 'astro';
import { createSupabaseServerClient, hasSupabaseConfig } from '@/lib/supabase/server';

export const POST: APIRoute = async (context) => {
  if (hasSupabaseConfig()) {
    const supabase = createSupabaseServerClient(context);
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      return new Response('Sesi tidak dapat diakhiri. Silakan coba lagi.', { status: 500 });
    }
  }

  return context.redirect('/login?logout=success', 303);
};

export const GET: APIRoute = (context) => context.redirect('/login', 303);