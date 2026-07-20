import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ url, cookies, redirect }) => {
  if (!import.meta.env.DEV || import.meta.env.PUBLIC_SUPABASE_URL) {
    return new Response('Not found', { status: 404 });
  }
  const role = url.searchParams.get('role') === 'admin' ? 'admin' : 'employee';
  cookies.set('demo-role', role, { path: '/', sameSite: 'lax' });
  return redirect(role === 'admin' ? '/admin' : '/app');
};
