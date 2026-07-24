[35m.env.example[m[36m:[m[32m1[m[36m:[m[1;31mPUBLIC_SUPABASE[m_URL=https://your-project.supabase.co
[35m.env.example[m[36m:[m[32m2[m[36m:[m[1;31mPUBLIC_SUPABASE[m_PUBLISHABLE_KEY=sb_publishable_your_key
[35mREADME.md[m[36m:[m[32m124[m[36m:[m[1;31mPUBLIC_SUPABASE[m_URL
[35mREADME.md[m[36m:[m[32m125[m[36m:[m[1;31mPUBLIC_SUPABASE[m_PUBLISHABLE_KEY
[35mscripts/provision-required-accounts.mjs[m[36m:[m[32m16[m[36m:[mconst url = process.env.[1;31mPUBLIC_SUPABASE[m_URL;
[35mscripts/provision-required-accounts.mjs[m[36m:[m[32m18[m[36m:[mif (!url || !secret) throw new Error('[1;31mPUBLIC_SUPABASE[m_URL dan SUPABASE_SECRET_KEY wajib dikonfigurasi.');
[35mscripts/setup-supabase.ps1[m[36m:[m[32m34[m[36m:[m  "[1;31mPUBLIC_SUPABASE[m_URL=$($projectUrl.TrimEnd('/'))"
[35mscripts/setup-supabase.ps1[m[36m:[m[32m35[m[36m:[m  "[1;31mPUBLIC_SUPABASE[m_PUBLISHABLE_KEY=$publishableKey"
[35msrc/env.d.ts[m[36m:[m[32m5[m[36m:[m  readonly [1;31mPUBLIC_SUPABASE[m_URL?: string;
[35msrc/env.d.ts[m[36m:[m[32m6[m[36m:[m  readonly [1;31mPUBLIC_SUPABASE[m_PUBLISHABLE_KEY?: string;
[35msrc/lib/supabase/server.ts[m[36m:[m[32m18[m[36m:[m  return validSupabaseUrl(import.meta.env.[1;31mPUBLIC_SUPABASE[m_URL)
[35msrc/lib/supabase/server.ts[m[36m:[m[32m19[m[36m:[m    && validPublishableKey(import.meta.env.[1;31mPUBLIC_SUPABASE[m_PUBLISHABLE_KEY);
[35msrc/lib/supabase/server.ts[m[36m:[m[32m30[m[36m:[m  const url = import.meta.env.[1;31mPUBLIC_SUPABASE[m_URL;
[35msrc/lib/supabase/server.ts[m[36m:[m[32m31[m[36m:[m  const key = import.meta.env.[1;31mPUBLIC_SUPABASE[m_PUBLISHABLE_KEY;
[35msrc/lib/supabase/server.ts[m[36m:[m[32m49[m[36m:[m  const url = import.meta.env.[1;31mPUBLIC_SUPABASE[m_URL;
[35msrc/lib/supabase/server.ts[m[36m:[m[32m50[m[36m:[m  const key = import.meta.env.[1;31mPUBLIC_SUPABASE[m_PUBLISHABLE_KEY;
[35msrc/lib/supabase/server.ts[m[36m:[m[32m65[m[36m:[m  const url = import.meta.env.[1;31mPUBLIC_SUPABASE[m_URL;
