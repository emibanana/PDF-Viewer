# Dot-source this in a PowerShell session before building the desktop app:
#   . .\dev-env.ps1
# Puts the no-admin MSVC toolchain (portable-msvc) and Rust (rustup, per-user) on PATH.
$msvc = Join-Path $env:USERPROFILE 'tools\msvc'
$vc   = Get-ChildItem (Join-Path $msvc 'VC\Tools\MSVC') | Sort-Object Name | Select-Object -Last 1
$sdk  = Get-ChildItem (Join-Path $msvc 'Windows Kits\10\Lib') | Sort-Object Name | Select-Object -Last 1
$kit  = Join-Path $msvc 'Windows Kits\10'
$env:PATH = @(
  (Join-Path $vc.FullName 'bin\Hostx64\x64'),
  (Join-Path $kit "bin\$($sdk.Name)\x64"),
  (Join-Path $kit "bin\$($sdk.Name)\x64\ucrt"),
  (Join-Path $env:USERPROFILE '.cargo\bin'),
  $env:PATH) -join ';'
$env:INCLUDE = @('include') | ForEach-Object { Join-Path $vc.FullName $_ } | Out-String -NoNewline
$env:INCLUDE = (@(Join-Path $vc.FullName 'include') + ('ucrt','shared','um','winrt','cppwinrt' | ForEach-Object { Join-Path $kit "Include\$($sdk.Name)\$_" })) -join ';'
$env:LIB = @(
  (Join-Path $vc.FullName 'lib\x64'),
  (Join-Path $kit "Lib\$($sdk.Name)\ucrt\x64"),
  (Join-Path $kit "Lib\$($sdk.Name)\um\x64")) -join ';'
Write-Host "MSVC $($vc.Name), SDK $($sdk.Name), cargo on PATH"
