import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { APIContext, AstroCookies } from 'astro';

export function hasSupabaseConfig(): boolean {
  return Boolean(
    import.meta.env.PUBLIC_SUPABASE_URL &&
      import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function createSupabaseServerClient({
  request,
  cookies,
}: Pick<APIContext, 'request' | 'cookies'> | {
  request: Request;
  cookies: AstroCookies;
}) {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error('Konfigurasi Supabase belum tersedia. Salin .env.example ke .env.local.');
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '');
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}
