# Internal Work Dashboard

Dashboard internal Astro SSR dengan Supabase Auth, Postgres, RLS, dan private Storage. Fitur mencakup absensi, target jam, tugas/checklist, progres dan bukti kerja, laporan mingguan, tunjangan, evaluasi, serta administrasi karyawan.

## Persyaratan

- Node.js 22+
- Project Supabase kosong
- Supabase CLI login ke akun yang memiliki akses project
- Publishable key; secret key hanya diperlukan untuk undangan dan aktivasi akun

## Setup project fresh

1. Install dependency:

```powershell
npm install
```

2. Masukkan Project URL dan key secara lokal:

```powershell
npm run setup:supabase
```

Nilai disimpan di `.env.local` dan tidak di-commit. Secret key tidak pernah memakai prefix `PUBLIC_`.

3. Login dan hubungkan Supabase CLI:

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --linked
```

Migration utama berada di `supabase/migrations`. Migration membuat seluruh tabel, enum, index, RLS, RPC terotorisasi, trigger profil, dan bucket private `work-evidence`. Database tetap kosong setelah migration.

4. Buat akun admin pertama melalui Supabase Dashboard > Authentication > Users. Setelah user dibuat, jalankan di SQL Editor dengan email admin yang benar:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"app_role":"admin"}'::jsonb
where email = 'admin@perusahaan.com';
```

Trigger migration akan membuat atau menyinkronkan `public.profiles`. Logout lalu login ulang agar JWT memperoleh role terbaru.

5. Di Authentication > URL Configuration, isi Site URL dan redirect URL:

```text
http://localhost:4321
http://localhost:4321/auth/callback
```

Tambahkan URL production saat deployment.

6. Jalankan aplikasi:

```powershell
npm run dev
```

## Role dan keamanan

- Semua route dashboard membutuhkan session Supabase valid.
- Role route berasal dari `app_metadata.app_role`, bukan metadata yang dapat diubah user.
- Akun nonaktif ditolak oleh middleware.
- Tabel pada schema `public` memakai explicit grants dan RLS.
- Karyawan hanya membaca datanya sendiri; admin membaca data tim.
- Mutasi sensitif memvalidasi user/role di database.
- Bukti kerja disimpan di bucket private, maksimal 10 MB.
- Secret key hanya dipakai server-side untuk undangan dan status akun.

Mengaktifkan Auto RLS saat membuat project boleh dan disarankan. Migration tetap mengaktifkan RLS secara eksplisit pada setiap tabel.

## Route

- Publik: `/login`, `/forgot-password`, `/reset-password`, `/auth/callback`
- Karyawan: `/app`, absensi, tugas, laporan, tunjangan, profil
- Admin: `/admin`, karyawan, tugas, target, absensi, laporan, tunjangan, evaluasi, pengaturan

## Verifikasi

```powershell
npm run build
npx tsc --noEmit
npm test
npx supabase migration list --linked
```

Setelah migration diterapkan, jalankan Security dan Performance Advisors di Supabase serta uji login admin/karyawan, redirect lintas-role, kondisi kosong, semua mutasi, review, dan logout.
