import { defineMiddleware } from 'astro:middleware';
import { adminUser, employeeUser } from '@/lib/demo-data';
import { createSupabaseServerClient, hasSupabaseConfig } from '@/lib/supabase/server';

const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password', '/auth/callback'];

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const demoMode = import.meta.env.DEV && !hasSupabaseConfig();

  context.locals.user = null;
  context.locals.role = null;
  context.locals.isDemo = demoMode;

  if (demoMode) {
    const cookieRole = context.cookies.get('demo-role')?.value;
    const routeRole = pathname.startsWith('/admin') ? 'admin' : 'employee';
    const role = cookieRole === 'admin' || cookieRole === 'employee' ? cookieRole : routeRole;
    context.locals.role = role;
    context.locals.user = role === 'admin' ? adminUser : employeeUser;
    return next();
  }

  if (hasSupabaseConfig()) {
    const supabase = createSupabaseServerClient(context);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const role = user.app_metadata.app_role === 'admin' ? 'admin' : 'employee';
      context.locals.role = role;
      context.locals.user = {
        id: user.id,
        email: user.email ?? '',
        fullName: user.user_metadata.full_name ?? user.email?.split('@')[0] ?? 'Pengguna',
        role,
        employeeCode: user.user_metadata.employee_code,
        avatar: (user.user_metadata.full_name ?? user.email ?? 'PG')
          .split(' ')
          .slice(0, 2)
          .map((part: string) => part[0])
          .join('')
          .toUpperCase(),
      };
    }
  }

  if (isPublic) return next();

  if (!context.locals.user) {
    return context.redirect('/login');
  }

  if (pathname.startsWith('/admin') && context.locals.role !== 'admin') {
    return context.redirect('/app');
  }

  if (pathname.startsWith('/app') && context.locals.role !== 'employee') {
    return context.redirect('/admin');
  }

  return next();
});
