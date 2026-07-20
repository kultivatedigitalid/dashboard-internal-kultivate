# Internal Work Dashboard Design System

## Direction

“Papan kerja pagi di studio yang terang”: putih bersih, tinta gelap, olive yang tenang sebagai warna tindakan, dan kepadatan moderat. Desain melayani pekerjaan dan tidak mencoba menjadi dekorasi.

## Color

Strategi restrained. Semua token menggunakan OKLCH. Olive dipakai untuk aksi utama dan pilihan aktif; warna semantik selalu disertai ikon atau teks.

- Background: `oklch(1 0 0)`
- Surface: `oklch(0.975 0.004 110)`
- Ink: `oklch(0.22 0.018 110)`
- Muted: `oklch(0.48 0.018 110)`
- Primary: `oklch(0.35 0.075 110)`
- Accent: `oklch(0.62 0.14 38)` hanya untuk perhatian berisiko/deadline
- Success, warning, danger, dan info memiliki token tersendiri dan tidak menggantikan label status.

## Typography

Gunakan satu system sans stack untuk performa dan keterbacaan: `Inter`, `Aptos`, `Segoe UI`, sans-serif. Skala tetap dan rapat untuk UI produk. Angka metrik memakai `font-variant-numeric: tabular-nums`.

## Layout

- Desktop: sidebar 248px, header sticky, content maksimum 1440px.
- Employee mobile: bottom navigation untuk lima tujuan utama.
- Admin mobile: drawer karena jumlah menu lebih banyak.
- Grid metrik memakai `auto-fit/minmax`; tabel berada dalam container scroll horizontal.

## Components

- Radius kartu 14px; control 10px; tombol boleh pill hanya untuk compact segmented actions.
- Kartu memakai border atau shadow tipis, tidak keduanya sebagai dekorasi.
- Tombol minimum 44px dan memiliki default, hover, focus, active, disabled, serta loading state.
- Progress selalu menampilkan actual, target, dan persentase.
- Empty state menyebut kondisi dan tindakan berikutnya.

## Motion

Transisi state 160–220ms dengan ease-out. Tidak ada entrance choreography. Drawer, popover, hover, dan progress boleh bergerak; reduced motion menghapus transform dan durasi.
