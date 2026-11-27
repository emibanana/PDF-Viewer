# Builds the production per-user MSI from the current tree and launches its installer.
# Run via "Build and Install.cmd" at the repo root (double-click).
$ErrorActionPreference = 'Stop'
$frontend = Split-Path -Parent $PSScriptRoot
$msiDir = Join-Path $frontend 'src-tauri\target\release\bundle\msi'

try {
  # build-msi-peruser.ps1 takes the first *.msi it finds, so a stale one must not be there.
  if (Test-Path $msiDir) { Get-ChildItem $msiDir -Filter '*.msi' | Remove-Item -Force }

  & (Join-Path $PSScriptRoot 'build-msi-peruser.ps1')

  $msi = Get-ChildItem $msiDir -Filter '*.msi' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $msi) { throw "No MSI found in $msiDir" }

  # An open viewer holds its exe locked, which makes the installer ask for a restart.
  Get-Process -Name 'PDF-Viewer' -ErrorAction SilentlyContinue | Stop-Process -Force

  Write-Host "Launching installer: $($msi.FullName)"
  Start-Process -FilePath $msi.FullName -Wait
  Write-Host 'Done.'
} catch {
  Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
  Read-Host 'Press Enter to close'
  exit 1
}
