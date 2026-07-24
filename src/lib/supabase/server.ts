import { env } from 'cloudflare:workers';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { APIContext, AstroCookies } from 'astro';

// ─── Runtime binding helpers ──────────────────────────────────────────────────
// Cloudflare Workers mengekspos env vars melalui `cloudflare:workers` bukan
// `import.meta.env`. Fungsi-fungsi ini membaca dan men-trim nilai dari binding.

function runtimeEnv(): Record<string, string | undefined> {
  return env as unknown as Record<string, string | undefined>;
}

function getRuntimeVar(key: string): string | undefined {
  return runtimeEnv()[key]?.trim() || undefined;
}

// ─── Validators ───────────────────────────────────────────────────────────────

function validSupabaseUrl(value?: string): value is string {
  return Boolean(value && /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(value) && !value.includes('your-project'));
}

function validPublishableKey(value?: string): value is string {
  return Boolean(value && (value.startsWith('sb_publishable_') || value.startsWith('eyJ')) && !value.includes('your_key'));
}

function validSecretKey(value?: string): value is string {
  return Boolean(value && (value.startsWith('sb_secret_') || value.startsWith('eyJ')) && !value.includes('your_'));
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export function hasSupabaseConfig(): boolean {
  return validSupabaseUrl(getRuntimeVar('PUBLIC_SUPABASE_URL'))
    && validPublishableKey(getRuntimeVar('PUBLIC_SUPABASE_PUBLISHABLE_KEY'));
}

export function hasSupabaseSecret(): boolean {
  return validSecretKey(getRuntimeVar('SUPABASE_SECRET_KEY'));
}

/** Mengembalikan PUBLIC_SITE_URL dari Cloudflare runtime binding, atau undefined jika tidak disetel. */
export function getPublicSiteUrl(): string | undefined {
  return getRuntimeVar('PUBLIC_SITE_URL');
}

// ─── Client factories ─────────────────────────────────────────────────────────

export function createSupabaseServerClient({
  request,
  cookies,
}: Pick<APIContext, 'request' | 'cookies'> | { request: Request; cookies: AstroCookies }) {
  const url = getRuntimeVar('PUBLIC_SUPABASE_URL');
  const key = getRuntimeVar('PUBLIC_SUPABASE_PUBLISHABLE_KEY');
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
  const url = getRuntimeVar('PUBLIC_SUPABASE_URL');
  const key = getRuntimeVar('PUBLIC_SUPABASE_PUBLISHABLE_KEY');
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
  const url = getRuntimeVar('PUBLIC_SUPABASE_URL');
  const secret = getRuntimeVar('SUPABASE_SECRET_KEY');
  if (!validSupabaseUrl(url) || !validSecretKey(secret)) {
    throw new Error('SUPABASE_SECRET_NOT_CONFIGURED');
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}