$ErrorActionPreference = 'Stop'
Write-Host ''
Write-Host 'Hubungkan Internal Work Dashboard ke Supabase' -ForegroundColor Green
Write-Host 'Nilai disimpan lokal di .env.local dan tidak akan masuk Git.' -ForegroundColor DarkGray
Write-Host ''

$projectUrl = Read-Host 'Project URL (https://xxxx.supabase.co)'
if ($projectUrl -notmatch '^https://[a-z0-9]+\.supabase\.co/?$') {
  throw 'Project URL tidak valid. Ambil URL dari Supabase Dashboard > Connect.'
}

$publishableKey = Read-Host 'Publishable key (sb_publishable_...)'
if ($publishableKey -notmatch '^(sb_publishable_|eyJ)') {
  throw 'Publishable key tidak valid.'
}

$secretSecure = Read-Host 'Secret key untuk invite/admin (opsional, input disembunyikan)' -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretSecure)
try {
  $secretKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
}
if ($secretKey -and $secretKey -notmatch '^(sb_secret_|eyJ)') {
  throw 'Secret key tidak valid. Kosongkan jika belum tersedia.'
}

$siteUrl = Read-Host 'Site URL [http://localhost:4321]'
if ([string]::IsNullOrWhiteSpace($siteUrl)) {
  $siteUrl = 'http://localhost:4321'
}

$lines = @(
  "PUBLIC_SUPABASE_URL=$($projectUrl.TrimEnd('/'))"
  "PUBLIC_SUPABASE_PUBLISHABLE_KEY=$publishableKey"
  "SUPABASE_SECRET_KEY=$secretKey"
  "PUBLIC_SITE_URL=$($siteUrl.TrimEnd('/'))"
)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$envPath = Join-Path (Get-Location) '.env.local'
[IO.File]::WriteAllText($envPath, ($lines -join [Environment]::NewLine) + [Environment]::NewLine, $utf8NoBom)

Write-Host ''
Write-Host 'Supabase terhubung di .env.local.' -ForegroundColor Green
Write-Host 'Terapkan migration: npx supabase link --project-ref <ref>, lalu npx supabase db push --linked' -ForegroundColor Yellow
Write-Host 'Restart server setelah konfigurasi atau migration berubah.' -ForegroundColor Yellow
Write-Host 'Jangan pernah memakai prefix PUBLIC_ untuk secret key.' -ForegroundColor DarkGray
