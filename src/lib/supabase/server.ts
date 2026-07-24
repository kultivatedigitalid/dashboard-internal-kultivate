import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { APIContext, AstroCookies } from 'astro';

function validSupabaseUrl(value?: string): value is string {
  return Boolean(value && /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(value) && !value.includes('your-project'));
}

function validPublishableKey(value?: string): value is string {
  return Boolean(value && (value.startsWith('sb_publishable_') || value.startsWith('eyJ')) && !value.includes('your_key'));
}

function validSecretKey(value?: string): value is string {
  return Boolean(value && (value.startsWith('sb_secret_') || value.startsWith('eyJ')) && !value.includes('your_'));
}

export function hasSupabaseConfig(): boolean {
  return validSupabaseUrl(import.meta.env.PUBLIC_SUPABASE_URL)
    && validPublishableKey(import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function hasSupabaseSecret(): boolean {
  return validSecretKey(import.meta.env.SUPABASE_SECRET_KEY);
}

export function createSupabaseServerClient({
  request,
  cookies,
}: Pick<APIContext, 'request' | 'cookies'> | { request: Request; cookies: AstroCookies }) {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!validSupabaseUrl(url) || !validPublishableKey(key)) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '');
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookies.set(name, value, options));
      },
    },
  });
}

export function createSupabaseOtpVerifier() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!validSupabaseUrl(url) || !validPublishableKey(key)) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function createSupabaseServiceClient() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const secret = import.meta.env.SUPABASE_SECRET_KEY;
  if (!validSupabaseUrl(url) || !validSecretKey(secret)) {
    throw new Error('SUPABASE_SECRET_NOT_CONFIGURED');
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}