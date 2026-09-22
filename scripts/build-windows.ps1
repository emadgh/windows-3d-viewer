$ErrorActionPreference = 'Stop'

$repo = Resolve-Path (Join-Path $PSScriptRoot '..')
$workspaceRoot = Join-Path $repo '.native-workspace'
$workspace = Join-Path $workspaceRoot 'windows-3d-viewer'
$outputDir = Join-Path $repo 'dist'

if (-not (Get-Command native -ErrorAction SilentlyContinue)) {
  throw 'Native SDK CLI is not installed. Run: npm install -g @native-sdk/cli@0.9.4'
}

if (Test-Path $workspace) { Remove-Item $workspace -Recurse -Force }
if (Test-Path $outputDir) { Remove-Item $outputDir -Recurse -Force }
New-Item -ItemType Directory -Path $workspaceRoot -Force | Out-Null
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

# Let Native SDK generate the version-matched build graph, then replace the
# authored surfaces with this repository's production manifest/frontend/core.
native init $workspace --frontend vite
Copy-Item (Join-Path $repo 'app.zon') (Join-Path $workspace 'app.zon') -Force
Copy-Item (Join-Path $repo 'app.json') (Join-Path $workspace 'app.json') -Force
Copy-Item (Join-Path $repo 'native/main.zig') (Join-Path $workspace 'src/main.zig') -Force
Remove-Item (Join-Path $workspace 'frontend') -Recurse -Force
Copy-Item (Join-Path $repo 'frontend') (Join-Path $workspace 'frontend') -Recurse -Force

Push-Location $workspace
try {
  npm install --prefix frontend
  npm run build --prefix frontend

  # native build validates app.zon as part of the generated build graph.
  native build
  native package --target windows --assets frontend/dist

  $packageRoot = Join-Path $workspace 'zig-out/package/windows-3d-viewer-windows'
  if (-not (Test-Path $packageRoot)) {
    throw "Expected packaged application was not created: $packageRoot"
  }

  # The association launcher lives beside bin/ and resources/. It stages a
  # model plus related sidecar assets into the packaged frontend before
  # starting the native shell, allowing Explorer/default-app launches to use
  # the same Three.js loading path as drag/drop and the file picker.
  Copy-Item (Join-Path $repo 'windows/open-model.ps1') (Join-Path $packageRoot 'open-model.ps1') -Force

  $packageExe = Join-Path $packageRoot 'bin/windows-3d-viewer.exe'
  $webViewLoader = Join-Path $packageRoot 'bin/WebView2Loader.dll'
  $frontendIndex = Join-Path $packageRoot 'resources/frontend/dist/index.html'
  $associationLauncher = Join-Path $packageRoot 'open-model.ps1'
  foreach ($required in @($packageExe, $webViewLoader, $frontendIndex, $associationLauncher)) {
    if (-not (Test-Path $required)) { throw "Required packaged file is missing: $required" }
  }

  $zip = Join-Path $outputDir 'windows-3d-viewer-windows-x64.zip'
  Compress-Archive -Path $packageRoot -DestinationPath $zip -Force

  Write-Host "Portable Windows package: $zip"
  Write-Host 'Important: keep bin/, resources/, open-model.ps1 and the executable together. Do not copy the EXE out of the package.'
}
finally {
  Pop-Location
}
