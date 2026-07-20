# Internal Work Dashboard

Dashboard internal Astro SSR untuk 1 admin dan 3 karyawan, mengikuti blueprint proyek: absensi, target 600 jam, tugas/checklist, laporan mingguan, bukti kerja, tunjangan, dan evaluasi.

## Menjalankan lokal

Persyaratan: Node.js 22 atau lebih baru.

```powershell
npm install
npm run dev
```

Buka `http://127.0.0.1:4321`. Tanpa konfigurasi Supabase, development otomatis memakai data demo dan kedua dashboard tetap dapat ditinjau.

## Menghubungkan Supabase online

Jalankan perintah berikut dan masukkan Project URL serta publishable key langsung di terminal:

```powershell
npm run setup:supabase
```

Nilai disimpan ke `.env.local`, yang sudah di-ignore Git. Ambil nilainya dari Supabase Dashboard melalui menu **Connect**:

- `PUBLIC_SUPABASE_URL`: Project URL.
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key (`sb_publishable_...`).
- `SUPABASE_SECRET_KEY`: hanya untuk operasi admin server-side; jangan memakai prefix `PUBLIC_` atau memasukkannya ke browser.

Setelah setup, restart server:

```powershell
.\node_modules\.bin\astro.cmd dev stop
npm run dev
```

## Perintah

```powershell
npm run dev
npm run build
npm run test
npm run check
```

## Route utama

- Publik: `/login`, `/forgot-password`, `/reset-password`
- Karyawan: `/app`, `/app/attendance`, `/app/tasks`, `/app/weekly-report`, `/app/allowances`, `/app/profile`
- Admin: `/admin`, `/admin/employees`, `/admin/tasks`, `/admin/targets`, `/admin/attendance`, `/admin/reports`, `/admin/allowances`, `/admin/evaluations`, `/admin/settings`

## Keamanan

- Supabase client dibuat per request.
- Role berasal dari `app_metadata.app_role`, bukan `user_metadata`.
- Semua tabel exposed wajib memakai RLS dan explicit grants.
- Bucket bukti kerja harus private.
- Jangan commit `.env.local` atau secret key.

Dokumen produk dan visual berada di `PRODUCT.md` dan `DESIGN.md`.
