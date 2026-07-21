import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ locals, redirect }) => {
  if (!locals.user) return redirect('/login');
  return redirect(locals.role === 'admin' ? '/admin' : '/app');
};
