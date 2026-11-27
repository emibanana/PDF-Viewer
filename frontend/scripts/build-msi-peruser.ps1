# Builds the PDF Viewer MSI as a per-user install (no admin prompt).
# Tauri's WiX bundler only emits per-machine MSIs, so we let it generate
# main.wxs, patch the scope and install folder, then re-run candle + light.
$ErrorActionPreference = 'Stop'
$frontend = Split-Path -Parent $PSScriptRoot
Push-Location $frontend
try {
  npx tauri build --bundles msi
  if ($LASTEXITCODE -ne 0) { throw 'tauri build failed' }

  $wixDir = Join-Path $frontend 'src-tauri\target\release\wix\x64'
  $wxs = Join-Path $wixDir 'main.wxs'
  $tools = Join-Path $env:LOCALAPPDATA 'tauri\WixTools314'
  $msiDir = Join-Path $frontend 'src-tauri\target\release\bundle\msi'
  $msi = (Get-ChildItem $msiDir -Filter '*.msi' | Select-Object -First 1).FullName

  $text = Get-Content $wxs -Raw
  $text = $text.Replace('InstallScope="perMachine"', 'InstallScope="perUser"')
  $pattern = '(?s)<Directory Id="\$\(var\.PlatformProgramFilesFolder\)" Name="PFiles">\s*<Directory Id="INSTALLDIR" Name="PDF Viewer"/>\s*</Directory>'
  $text = [regex]::Replace($text, $pattern, '<Directory Id="LocalAppDataFolder"><Directory Id="PerUserPrograms" Name="Programs"><Directory Id="INSTALLDIR" Name="PDF Viewer"/></Directory></Directory>')
  if ($text -notmatch 'PerUserPrograms') { throw 'directory patch did not apply' }
  Set-Content $wxs $text -Encoding UTF8

  $wixobj = Join-Path $wixDir 'main.wixobj'
  & "$tools\candle.exe" -nologo -arch x64 -ext WixUIExtension -ext WixUtilExtension -out $wixobj $wxs
  if ($LASTEXITCODE -ne 0) { throw 'candle failed' }
  & "$tools\light.exe" -nologo -sval -ext WixUIExtension -ext WixUtilExtension -loc (Join-Path $wixDir 'locale.wxl') -out $msi $wixobj
  if ($LASTEXITCODE -ne 0) { throw 'light failed' }
  Write-Host "Per-user MSI: $msi"
} finally { Pop-Location }
