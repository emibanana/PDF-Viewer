# Dev/build environment for the Windows desktop app. Dot-source it:  . .\dev-env.ps1
# Affects only the current PowerShell process (no registry or persistent PATH changes).
# Uses system-wide Visual Studio Build Tools when present, otherwise the per-user
# portable MSVC in %USERPROFILE%\tools\msvc (no admin needed). Works on both setups.
$ErrorActionPreference = 'Stop'

function Import-BatEnv([string]$bat) {
  cmd /c "`"$bat`" >nul && set" | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') { Set-Item "env:$($Matches[1])" $Matches[2] }
  }
}

$vsw = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$vs = $null
if (Test-Path $vsw) {
  $vs = & $vsw -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
}
if ($vs) {
  Import-BatEnv (Join-Path $vs 'VC\Auxiliary\Build\vcvars64.bat')
  Write-Host "MSVC: system install ($vs)"
} else {
  $root = Join-Path $env:USERPROFILE 'tools\msvc'
  $setup = Join-Path $root 'setup_x64.bat'
  if (-not (Test-Path $setup)) { throw "No Visual Studio Build Tools found and no portable MSVC at $root" }
  Import-BatEnv $setup
  Write-Host "MSVC: portable ($root)"
}

$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if ($env:Path -notlike "*$cargoBin*") { $env:Path = "$cargoBin;$env:Path" }

$link = (Get-Command link.exe -ErrorAction SilentlyContinue).Source
if ($link -match '\\Git\\') { Write-Warning "GNU link ($link) shadows the MSVC linker. Use PowerShell, not Git Bash." }
foreach ($t in 'node', 'cargo', 'link') {
  if (-not (Get-Command $t -ErrorAction SilentlyContinue)) { Write-Warning "$t not found on PATH" }
}
