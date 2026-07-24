/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Cloudflare Workers virtual module — hanya ada di runtime, bukan di Node.
// Deklarasi ini diperlukan agar TypeScript tidak error saat type-checking.
declare module 'cloudflare:workers' {
  const env: Env;
  export { env };
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly SUPABASE_SECRET_KEY?: string;
  readonly PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
