$ErrorActionPreference = 'Stop'

$repo = Resolve-Path (Join-Path $PSScriptRoot '..')
$workspaceRoot = Join-Path $repo '.native-workspace'
$workspace = Join-Path $workspaceRoot 'windows-3d-viewer'
$outputDir = Join-Path $repo 'dist'
$loaderCache = Join-Path $workspaceRoot 'WebView2Loader.dll'

if (-not (Get-Command native -ErrorAction SilentlyContinue)) {
  throw 'Native SDK CLI is not installed. Run: npm install -g @native-sdk/cli@0.9.4'
}

if (Test-Path $workspace) { Remove-Item $workspace -Recurse -Force }
if (Test-Path $outputDir) { Remove-Item $outputDir -Recurse -Force }
if (Test-Path $loaderCache) { Remove-Item $loaderCache -Force }
New-Item -ItemType Directory -Path $workspaceRoot -Force | Out-Null
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

# Generate a version-matched Native SDK workspace. First build the untouched
# Vite scaffold once so Native SDK materializes its vendored WebView2Loader.dll;
# the production executable will embed that DLL instead of shipping it beside
# the EXE.
native init $workspace --frontend vite
Push-Location $workspace
try {
  native build
  if ($LASTEXITCODE -ne 0) { throw 'Native SDK bootstrap build failed.' }

  $bootstrapLoader = Join-Path $workspace 'zig-out/bin/WebView2Loader.dll'
  if (-not (Test-Path $bootstrapLoader)) {
    throw "Native SDK bootstrap did not produce WebView2Loader.dll: $bootstrapLoader"
  }
  Copy-Item $bootstrapLoader $loaderCache -Force
}
finally {
  Pop-Location
}

# Replace the scaffold surfaces with this repository's production app.
Copy-Item (Join-Path $repo 'app.zon') (Join-Path $workspace 'app.zon') -Force
Copy-Item (Join-Path $repo 'app.json') (Join-Path $workspace 'app.json') -Force
Copy-Item (Join-Path $repo 'native/main.zig') (Join-Path $workspace 'src/main.zig') -Force
Remove-Item (Join-Path $workspace 'frontend') -Recurse -Force
Copy-Item (Join-Path $repo 'frontend') (Join-Path $workspace 'frontend') -Recurse -Force

Push-Location $workspace
try {
  npm install --prefix frontend
  npm run build --prefix frontend

  # Stage every runtime dependency under src/ so Zig can @embedFile it into
  # the final executable. Nothing in this tree is shipped separately.
  $embeddedRoot = Join-Path $workspace 'src/embedded'
  if (Test-Path $embeddedRoot) { Remove-Item $embeddedRoot -Recurse -Force }
  New-Item -ItemType Directory -Path $embeddedRoot -Force | Out-Null

  Copy-Item $loaderCache (Join-Path $embeddedRoot 'WebView2Loader.dll') -Force
  Copy-Item (Join-Path $repo 'windows/open-model.ps1') (Join-Path $embeddedRoot 'open-model.ps1') -Force
  New-Item -ItemType Directory -Path (Join-Path $embeddedRoot 'frontend') -Force | Out-Null
  Copy-Item (Join-Path $workspace 'frontend/dist') (Join-Path $embeddedRoot 'frontend/dist') -Recurse -Force

  $generatedAssets = Join-Path $workspace 'src/embedded_assets.zig'
  $lines = New-Object 'System.Collections.Generic.List[string]'
  $lines.Add('pub const version = "0.3.0";')
  $lines.Add('pub const Asset = struct { path: []const u8, data: []const u8 };')
  $lines.Add('pub const assets = [_]Asset{')

  Get-ChildItem -LiteralPath $embeddedRoot -Recurse -File | Sort-Object FullName | ForEach-Object {
    $relative = $_.FullName.Substring($embeddedRoot.Length).TrimStart('\', '/') -replace '\\', '/'
    $runtimePath = $relative.Replace('"', '\"')
    $embedPath = ('embedded/' + $relative).Replace('"', '\"')
    $lines.Add(('    .{{ .path = "{0}", .data = @embedFile("{1}") }},' -f $runtimePath, $embedPath))
  }
  $lines.Add('};')

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($generatedAssets, ($lines -join "`n") + "`n", $utf8NoBom)

  native build
  if ($LASTEXITCODE -ne 0) { throw 'Production single-file build failed.' }

  $builtExe = Join-Path $workspace 'zig-out/bin/windows-3d-viewer.exe'
  if (-not (Test-Path $builtExe)) { throw "Expected executable was not created: $builtExe" }

  $singleExe = Join-Path $outputDir 'windows-3d-viewer.exe'
  Copy-Item $builtExe $singleExe -Force

  $extraFiles = @(Get-ChildItem -LiteralPath $outputDir -File | Where-Object { $_.Name -ne 'windows-3d-viewer.exe' })
  if ($extraFiles.Count -ne 0) {
    throw ('Single-file output contains unexpected files: ' + (($extraFiles | Select-Object -ExpandProperty Name) -join ', '))
  }

  Write-Host "Single-file Windows executable: $singleExe"
  Write-Host 'Frontend assets, decoder files, WebView2Loader.dll and the association launcher are embedded in the EXE.'
}
finally {
  Pop-Location
}
