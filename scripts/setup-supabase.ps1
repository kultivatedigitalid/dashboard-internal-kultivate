$ErrorActionPreference = 'Stop'
Write-Host ''
Write-Host 'Hubungkan Internal Work Dashboard ke Supabase' -ForegroundColor Green
Write-Host 'Nilai disimpan lokal di .env.local dan tidak akan masuk Git.' -ForegroundColor DarkGray
Write-Host ''
$projectUrl = Read-Host 'Project URL (https://xxxx.supabase.co)'
if ($projectUrl -notmatch '^https://.+\.supabase\.co/?$') { throw 'Project URL tidak valid. Ambil URL dari Supabase Dashboard > Connect.' }
$publishableKey = Read-Host 'Publishable key (sb_publishable_...)'
if ([string]::IsNullOrWhiteSpace($publishableKey)) { throw 'Publishable key wajib diisi.' }
$siteUrl = Read-Host 'Site URL [http://localhost:4321]'
if ([string]::IsNullOrWhiteSpace($siteUrl)) { $siteUrl = 'http://localhost:4321' }
$envContent = "PUBLIC_SUPABASE_URL=$($projectUrl.TrimEnd('/'))`nPUBLIC_SUPABASE_PUBLISHABLE_KEY=$publishableKey`nPUBLIC_SITE_URL=$siteUrl`n"
Set-Content -LiteralPath '.env.local' -Value $envContent -Encoding utf8
Write-Host ''
Write-Host 'Supabase terhubung di .env.local.' -ForegroundColor Green
Write-Host 'Restart server: astro dev stop, lalu npm run dev' -ForegroundColor Yellow
Write-Host 'Jangan tempel SUPABASE_SECRET_KEY ke browser atau commit.' -ForegroundColor DarkGray
