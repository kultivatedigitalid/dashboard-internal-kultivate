import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient, hasSupabaseConfig } from '@/lib/supabase/server';

const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password', '/verify-otp', '/auth/callback'];

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;
  const isPublic = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));

  context.locals.user = null;
  context.locals.role = null;
  context.locals.otpRequired = false;

  if (!hasSupabaseConfig()) {
    if (isPublic) return next();
    return context.redirect('/login?error=config');
  }

  const supabase = createSupabaseServerClient(context);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (user && !authError) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name, employee_code, role, is_active, first_login_verified_at')
      .eq('id', user.id)
      .maybeSingle();

    const role = user.app_metadata.app_role === 'admin' ? 'admin' : 'employee';
    if (profile && profile.is_active && profile.role === role) {
      const fullName = profile.full_name || user.user_metadata.full_name || user.email?.split('@')[0] || 'Pengguna';
      context.locals.role = role;
      context.locals.otpRequired = !profile.first_login_verified_at;
      context.locals.user = {
        id: user.id,
        email: profile.email || user.email || '',
        fullName,
        role,
        employeeCode: profile.employee_code ?? undefined,
        avatar: fullName.split(' ').filter(Boolean).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase(),
      };
    } else {
      await supabase.auth.signOut();
      if (!isPublic) return context.redirect('/login?error=inactive');
    }
  }

  if (isPublic) return next();
  if (!context.locals.user) return context.redirect('/login');
  if (context.locals.otpRequired) return context.redirect('/verify-otp');

  if (pathname.startsWith('/admin') && context.locals.role !== 'admin') return context.redirect('/app');
  if (pathname.startsWith('/app') && context.locals.role !== 'employee') return context.redirect('/admin');

  return next();
});
