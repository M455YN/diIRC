<#
.SYNOPSIS
  Publishes a skipahead release: bumps the version on `skipahead`, tags it, pushes,
  and waits until the fork's latest.json serves the new version.

.PARAMETER Version
  Version without the "v" prefix, e.g. 0.3.5-2. Empty = next prerelease number.

.PARAMETER NoWait
  Do not wait for the GitHub release / latest.json after pushing.
#>
param(
  [Parameter(Position = 0)]
  [string]$Version = "",
  [switch]$NoWait,
  [int]$TimeoutMinutes = 45
)

$ErrorActionPreference = "Continue"
$ReleaseBranch = "skipahead"
$Repo = "M455YN/diIRC"
$LatestJsonUrl = "https://github.com/$Repo/releases/latest/download/latest.json"

# Throws so the finally block always restores the original branch and stash.
function Fail([string]$message) {
  throw $message
}

function Invoke-Git {
  & git @args
  if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed (exit $LASTEXITCODE)" }
}

function Parse-Version([string]$v) {
  if ($v -notmatch '^(\d+)\.(\d+)\.(\d+)(?:-(\d+))?$') { return $null }
  $pre = if ($Matches[4]) { [int]$Matches[4] } else { [int]::MaxValue }
  return @([int]$Matches[1], [int]$Matches[2], [int]$Matches[3], $pre)
}

# Semver ordering for X.Y.Z and X.Y.Z-N (a numeric prerelease is lower than the plain release).
function Compare-Version([string]$a, [string]$b) {
  $pa = Parse-Version $a
  $pb = Parse-Version $b
  for ($i = 0; $i -lt 4; $i++) {
    if ($pa[$i] -ne $pb[$i]) { return [Math]::Sign($pa[$i] - $pb[$i]) }
  }
  return 0
}

Set-Location (Split-Path -Parent $PSScriptRoot)

if ((Test-Path ".git/MERGE_HEAD") -or (Test-Path ".git/rebase-merge") -or (Test-Path ".git/rebase-apply")) {
  Write-Host "ERROR: A merge or rebase is in progress. Finish it first." -ForegroundColor Red
  exit 1
}

$originalBranch = (& git rev-parse --abbrev-ref HEAD).Trim()
$stashed = $false

try {
  if (& git status --porcelain --untracked-files=no) {
    Write-Host "Stashing local changes on '$originalBranch'..." -ForegroundColor Yellow
    Invoke-Git stash push -m "release-skipahead autostash ($originalBranch)"
    $stashed = $true
  }

  Write-Host "Updating '$ReleaseBranch'..." -ForegroundColor Cyan
  Invoke-Git fetch origin --tags --quiet
  Invoke-Git checkout -B $ReleaseBranch "refs/heads/$ReleaseBranch" --quiet
  Invoke-Git pull --ff-only origin "refs/heads/$ReleaseBranch" --quiet

  $current = (Get-Content package.json -Raw | ConvertFrom-Json).version
  if (-not (Parse-Version $current)) { Fail "Unsupported current version '$current' in package.json." }

  if (-not $Version) {
    $p = Parse-Version $current
    $Version = if ($current -match '-\d+$') { "$($p[0]).$($p[1]).$($p[2])-$($p[3] + 1)" }
               else { "$($p[0]).$($p[1]).$($p[2] + 1)-1" }
  }
  $Version = $Version.TrimStart("v")

  if ($Version -notmatch '^\d+\.\d+\.\d+-\d+$') {
    Fail "Version must look like 0.3.5-2 (numeric prerelease is required for MSI)."
  }
  if ((Compare-Version $Version $current) -le 0) {
    Fail "Version $Version is not newer than the current $current, so clients would not see it as an update."
  }

  $tag = "v$Version"
  if (& git tag -l $tag) { Fail "Tag $tag already exists locally. Use the 'Release: re-push tag' task to rebuild it." }
  if (& git ls-remote --tags origin "refs/tags/$tag") { Fail "Tag $tag already exists on origin." }

  Write-Host "Releasing $current -> $Version on '$ReleaseBranch'..." -ForegroundColor Cyan
  & npx --yes bumpp package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml `
    --release $Version --yes --commit "chore: release v%s" --tag "v%s" --push
  if ($LASTEXITCODE -ne 0) { throw "bumpp failed (exit $LASTEXITCODE)" }

  if (-not (& git ls-remote --tags origin "refs/tags/$tag")) { throw "Tag $tag was not pushed to origin." }
  Write-Host "Pushed $tag. Build: https://github.com/$Repo/actions" -ForegroundColor Green
}
catch {
  Write-Host "ERROR: $_" -ForegroundColor Red
  $failed = $true
}
finally {
  if ((& git rev-parse --abbrev-ref HEAD).Trim() -ne $originalBranch) {
    & git checkout -B $originalBranch "refs/heads/$originalBranch" --quiet
  }
  if ($stashed) {
    & git stash pop --quiet
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Could not restore stashed changes automatically. They are kept in 'git stash list'." -ForegroundColor Yellow
    }
  }
}

if ($failed) { exit 1 }
if ($NoWait) { exit 0 }

Write-Host "Waiting for the release build (up to $TimeoutMinutes min; Ctrl+C to stop waiting)..." -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
while ((Get-Date) -lt $deadline) {
  try {
    $latest = Invoke-RestMethod -Uri $LatestJsonUrl -Headers @{ "Cache-Control" = "no-cache" } -TimeoutSec 20
    if ($latest.version -eq $Version) {
      Write-Host "latest.json now serves $Version; clients on the Skipahead channel will be offered the update." -ForegroundColor Green
      Write-Host "Release: https://github.com/$Repo/releases/tag/$tag"
      exit 0
    }
    Write-Host "  $(Get-Date -Format HH:mm:ss) latest.json still at $($latest.version)"
  }
  catch {
    Write-Host "  $(Get-Date -Format HH:mm:ss) latest.json not available yet"
  }
  Start-Sleep -Seconds 60
}

Write-Host "Timed out. Check the build: https://github.com/$Repo/actions" -ForegroundColor Yellow
exit 1
