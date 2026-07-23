#Requires -Version 5.1
<#
.SYNOPSIS
    Local emergency fallback: build, sign, and emit latest.json for a Lyrizzy
    release on Windows only, without GitHub Actions.

.DESCRIPTION
    The primary release path is pushing a v* git tag, which runs
    .github/workflows/release.yml (builds + signs both Windows and Linux,
    stages a draft GitHub Release). Use this script only when GitHub Actions
    is unavailable and a release cannot wait — see docs/release.md
    "Local Emergency Fallback". It runs npm run tauri build, signs the NSIS
    installer, and writes dist/latest.json in the format expected by
    tauri-plugin-updater, for Windows only.

.PARAMETER PrivateKeyPath
    Path to the Tauri signing private key.
    Defaults to $env:TAURI_SIGNING_PRIVATE_KEY_PATH, then ~/.trinity-tauri-private-key.

.PARAMETER Version
    Version string for this release (e.g. "1.2.0").
    Defaults to the version in package.json.

.PARAMETER RepoUrl
    GitHub repository base URL (without trailing slash).
    E.g. "https://github.com/Vinnissaum/triade"

.PARAMETER ReleaseNotes
    Short release notes text included in latest.json.

.EXAMPLE
    .\scripts\release.ps1 -Version "1.2.0" -RepoUrl "https://github.com/Vinnissaum/triade"
#>
param(
    [string]$PrivateKeyPath = "",
    [string]$Version        = "",
    [string]$RepoUrl        = "https://github.com/Vinnissaum/triade",
    [string]$ReleaseNotes   = "See GitHub Release for full changelog."
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Resolve private key path ─────────────────────────────────────────────────

if (-not $PrivateKeyPath) {
    $PrivateKeyPath = $env:TAURI_SIGNING_PRIVATE_KEY_PATH
}
if (-not $PrivateKeyPath) {
    $PrivateKeyPath = Join-Path $env:USERPROFILE ".trinity-tauri-private-key"
}
if (-not (Test-Path $PrivateKeyPath)) {
    Write-Error "Private key not found at '$PrivateKeyPath'. Run: npx tauri signer generate -w `"$PrivateKeyPath`""
}

# ── Resolve version ──────────────────────────────────────────────────────────

if (-not $Version) {
    $pkg = Get-Content (Join-Path $PSScriptRoot "..\package.json") -Raw | ConvertFrom-Json
    $Version = $pkg.version
}
Write-Host "Building version $Version" -ForegroundColor Cyan

# ── Build ─────────────────────────────────────────────────────────────────────

Write-Host "Running: npm run tauri build" -ForegroundColor Cyan
npm run tauri build
if ($LASTEXITCODE -ne 0) { throw "tauri build failed (exit $LASTEXITCODE)" }

# ── Locate installer ─────────────────────────────────────────────────────────

$bundleDir  = Join-Path $PSScriptRoot "..\src-tauri\target\release\bundle\nsis"
$installers = @(Get-ChildItem -Path $bundleDir -Filter "*_x64-setup.exe" -ErrorAction SilentlyContinue)
if ($installers.Count -eq 0) {
    throw "No NSIS installer found in $bundleDir. Check the build output."
}
$installer = $installers[0].FullName
Write-Host "Installer: $installer" -ForegroundColor Green

# ── Sign ──────────────────────────────────────────────────────────────────────

Write-Host "Signing installer..." -ForegroundColor Cyan
$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content $PrivateKeyPath -Raw).Trim()
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = if ($env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) { $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD } else { "" }

npx tauri signer sign -k $PrivateKeyPath -- $installer
if ($LASTEXITCODE -ne 0) { throw "tauri signer sign failed (exit $LASTEXITCODE)" }

$sigFile = "$installer.sig"
if (-not (Test-Path $sigFile)) { throw "Signature file not found: $sigFile" }
$signature = (Get-Content $sigFile -Raw).Trim()

# ── Emit latest.json ──────────────────────────────────────────────────────────

$installerName = [System.IO.Path]::GetFileName($installer)
$downloadUrl   = "$RepoUrl/releases/download/v$Version/$installerName"
$pubDate       = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")

$manifest = [ordered]@{
    version  = $Version
    notes    = $ReleaseNotes
    pub_date = $pubDate
    platforms = [ordered]@{
        "windows-x86_64" = [ordered]@{
            url       = $downloadUrl
            signature = $signature
        }
    }
}

$distDir = Join-Path $PSScriptRoot "..\dist"
if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }

$manifestPath = Join-Path $distDir "latest.json"
$manifest | ConvertTo-Json -Depth 4 | Out-File -FilePath $manifestPath -Encoding utf8

Write-Host ""
Write-Host "latest.json written to: $manifestPath" -ForegroundColor Green
Write-Host ""
Write-Host "This is the Windows-only local emergency fallback (see docs/release.md)." -ForegroundColor Yellow
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Create a GitHub Release for tag v$Version"
Write-Host "  2. Upload: $installer"
Write-Host "  3. Upload: $manifestPath"
Write-Host "  4. Publish the release"
Write-Host "  5. Follow up with a normal 'git tag v$Version && git push origin v$Version' once"
Write-Host "     GitHub Actions is available again, to get a matching Linux build"
Write-Host ""
Write-Host "Done." -ForegroundColor Green
