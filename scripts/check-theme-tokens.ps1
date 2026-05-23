# check-theme-tokens.ps1
# Lints operator-window component files to catch hard-coded color classes that
# should use semantic tokens instead. Exits with code 1 if violations are found.
#
# Usage: .\scripts\check-theme-tokens.ps1
#        Add to CI as: pwsh -File scripts/check-theme-tokens.ps1

param(
    [string]$SourceDir = "src"
)

# Classes that must not appear in operator-window components.
# Projection / presentation renderer components are excluded via the allowlist.
$ProblemPatterns = @(
    'bg-gray-(700|800|900)\b',    # dark gray backgrounds → use bg-surface / bg-surface-2
    'border-gray-(600|700)\b',    # dark gray borders → use border-border
    'bg-blue-(500|600)\b',        # hardcoded blue → use bg-primary
    'bg-emerald-(500|600)\b',     # hardcoded emerald → use bg-primary or semantic
    'text-gray-(800|900)\b',      # near-black text → use text-fg
    'text-white\b',               # bare text-white → use text-fg-on-primary or text-fg
    'text-black\b',               # bare text-black → use text-fg
    'bg-white\b',                 # bare bg-white → use bg-surface or bg-surface-2
    'text-blue-(500|600)\b'       # hardcoded blue text → use text-primary
)

# Files/directories that are allowed to use hard-coded projection colors
# (full-screen renderer components always render on a black projection surface).
$AllowlistPaths = @(
    "src/components/presentation/SongBackground",
    "src/components/presentation/MediaSlideRenderer",
    "src/components/presentation/TransitionStage",
    "src/components/presentation/CountdownRenderer",
    "src/components/presentation/AnnouncementRenderer",
    "src/components/presentation/WebViewRenderer",
    "src/components/presentation/SlideshowRenderer",
    "src/components/presentation/QuickMediaRenderer",
    "src/components/presentation/QuickWebViewRenderer",
    "src/components/presentation/LivePreview",
    "src/windows/presentation"
)

$ComponentFiles = Get-ChildItem -Path $SourceDir -Recurse -Include "*.tsx","*.ts" |
    Where-Object { $_.FullName -notmatch "\\node_modules\\" } |
    Where-Object { $_.FullName -notmatch "\.test\." } |
    Where-Object { $_.FullName -notmatch "\.snap\." }

$violations = [System.Collections.Generic.List[string]]::new()

foreach ($file in $ComponentFiles) {
    $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")

    $inAllowlist = $false
    foreach ($allowed in $AllowlistPaths) {
        if ($relativePath -like "*$allowed*") {
            $inAllowlist = $true
            break
        }
    }
    if ($inAllowlist) { continue }

    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }

    foreach ($pattern in $ProblemPatterns) {
        $matches = [regex]::Matches($content, $pattern)
        foreach ($m in $matches) {
            $lineNumber = ($content.Substring(0, $m.Index) -split "`n").Count
            $violations.Add("  ${relativePath}:${lineNumber} [$($m.Value)] -> use semantic token")
        }
    }
}

if ($violations.Count -eq 0) {
    Write-Host "check-theme-tokens: OK — no hard-coded color classes found." -ForegroundColor Green
    exit 0
} else {
    Write-Host "check-theme-tokens: FAIL — $($violations.Count) hard-coded color class(es) found:" -ForegroundColor Red
    foreach ($v in $violations) {
        Write-Host $v -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Fix: replace with semantic token (bg-surface, bg-primary, text-fg, border-border, etc.)" -ForegroundColor Cyan
    Write-Host "Or:  add the file to the allowlist if projection-only colors are intentional." -ForegroundColor Cyan
    exit 1
}
