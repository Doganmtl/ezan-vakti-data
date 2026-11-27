#Requires -Version 5.1
<#
.SYNOPSIS
  Diyanet Awqat Salah 3 ilçelik kontrollü pilotu (11 istek) Windows PowerShell'de güvenle çalıştırır.
.DESCRIPTION
  Sıra: depo/dal/commit kontrolü -> offline testler -> aynı gün raporu kontrolü -> açık onay ->
  e-posta ve şifre (şifre gizli girilir, komut geçmişine yazılmaz) -> pilot -> ortam değişkenleri ve
  şifrenin bellek kopyası temizlenir. -YalnizKontrol ile ağ isteği gönderilmeden tüm kontroller yapılır.
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\resmi\pilot-calistir.ps1 -YalnizKontrol
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\resmi\pilot-calistir.ps1
#>
[CmdletBinding()]
param([switch]$YalnizKontrol)
$ErrorActionPreference = 'Stop'
$BeklenenDal = 'feature/diyanet-api-preparation'

function Dur([string]$mesaj, [int]$kod = 1) { Write-Host "DUR: $mesaj" -ForegroundColor Red; exit $kod }

# 1) Depo kökü, dal ve incelenmiş commit
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..\..'))
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Dur 'git bulunamadı.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Dur 'Node.js bulunamadı (22 veya üstü gerekli).' }
$dal = (git rev-parse --abbrev-ref HEAD).Trim()
if ($dal -ne $BeklenenDal) { Dur "Dal '$dal'; '$BeklenenDal' olmalı." }
if ((git status --porcelain --untracked-files=no)) { Dur 'Çalışma ağacında commit edilmemiş değişiklik var.' }
git fetch --quiet origin $BeklenenDal
if ($LASTEXITCODE -ne 0) { Dur 'GitHub dalı alınamadı.' }
$yerel = (git rev-parse HEAD).Trim(); $uzak = (git rev-parse "origin/$BeklenenDal").Trim()
if ($yerel -ne $uzak) { Dur "Yerel commit ($($yerel.Substring(0,7))) GitHub'daki ($($uzak.Substring(0,7))) ile aynı değil. 'git pull --ff-only' yapın." }
$nodeAna = [int](((node --version).Trim().TrimStart('v')).Split('.')[0])
if ($nodeAna -lt 22) { Dur "Node.js $nodeAna; 22 veya üstü gerekli." }
Write-Host "Depo: $BeklenenDal @ $($yerel.Substring(0,7)), Node $nodeAna" -ForegroundColor Cyan

# 2) Offline testler (ağ ve kota kullanmaz)
Write-Host 'Offline testler çalışıyor...' -ForegroundColor Cyan
# Yalnız *.test.mjs dosyaları (test/sahte-kaynak.mjs bir sunucudur, test değildir).
$testler = @(Get-ChildItem -Path test -Filter '*.test.mjs' | ForEach-Object { $_.FullName })
if ($testler.Count -eq 0) { Dur 'Test dosyası bulunamadı.' }
node --test @testler
if ($LASTEXITCODE -ne 0) { Dur 'Offline testler başarısız; pilot çalıştırılmadı.' }
node scripts/eslesme-dogrula.mjs
if ($LASTEXITCODE -ne 0) { Dur 'Eşleme tablosu doğrulaması başarısız.' }

# 3) Aynı gün raporu (kota harcamadan önce)
try { $tz = [TimeZoneInfo]::FindSystemTimeZoneById('Turkey Standard Time') } catch { $tz = [TimeZoneInfo]::FindSystemTimeZoneById('Europe/Istanbul') }
$bugun = [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $tz).ToString('yyyy-MM-dd')
$rapor = Join-Path 'golge' "pilot-$bugun.json"
if (Test-Path $rapor) { Dur "Bugünün pilot raporu zaten var: $rapor. Yeni istek gönderilmedi." 4 }

if ($YalnizKontrol) { Write-Host 'Tüm kontroller tamam. -YalnizKontrol: Diyanet API''sine istek gönderilmedi.' -ForegroundColor Green; exit 0 }

# 4) Açık onay
$onay = Read-Host "Pilot Diyanet API'sine en çok 11 istek gönderecek (3 ilçe). Devam için 'evet' yazın"
if ($onay -ne 'evet') { Write-Host 'İptal edildi; istek gönderilmedi.'; exit 0 }

# 5) Kimlik bilgileri: Read-Host girdileri komut geçmişine yazılmaz; şifre ekranda görünmez.
$email = Read-Host 'Awqat Salah e-posta'
$sifreGuvenli = Read-Host 'Awqat Salah şifre' -AsSecureString
$bstr = [IntPtr]::Zero
$kod = 1
try {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sifreGuvenli)
  # Yalnız bu PowerShell sürecine ve alt sürecine (node) görünür; kalıcı/kullanıcı ortamına yazılmaz.
  $env:AWQAT_EMAIL = $email
  $env:AWQAT_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $env:ALLOW_LIVE_API = 'evet'
  node scripts/resmi/pilot.mjs
  $kod = $LASTEXITCODE
}
finally {
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  Remove-Item Env:AWQAT_PASSWORD, Env:AWQAT_EMAIL, Env:ALLOW_LIVE_API -ErrorAction SilentlyContinue
  if ($sifreGuvenli) { $sifreGuvenli.Dispose() }
  Remove-Variable -Name email, sifreGuvenli, bstr -ErrorAction SilentlyContinue
  [GC]::Collect()
}
switch ($kod) {
  0 { Write-Host "PİLOT GEÇTİ. Rapor: $rapor (commit etmeyin; içeriğini paylaşabilirsiniz)." -ForegroundColor Green }
  1 { Write-Host "Pilot tamamlandı ama kriterlerden biri kaldı ya da durdu. Rapor: $rapor" -ForegroundColor Yellow }
  default { Write-Host "Pilot çalışmadı (kod $kod)." -ForegroundColor Red }
}
exit $kod
