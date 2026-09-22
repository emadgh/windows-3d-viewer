$ErrorActionPreference = 'Stop'

$repo = Resolve-Path (Join-Path $PSScriptRoot '..')
$workspaceRoot = Join-Path $repo '.native-workspace'
$workspace = Join-Path $workspaceRoot 'windows-3d-viewer'
$outputDir = Join-Path $repo 'dist'

if (-not (Get-Command native -ErrorAction SilentlyContinue)) {
  throw 'Native SDK CLI is not installed. Run: npm install -g @native-sdk/cli@0.9.4'
}

if (Test-Path $workspace) { Remove-Item $workspace -Recurse -Force }
New-Item -ItemType Directory -Path $workspaceRoot -Force | Out-Null
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

native init $workspace --frontend vite
Copy-Item (Join-Path $repo 'app.json') (Join-Path $workspace 'app.json') -Force
Remove-Item (Join-Path $workspace 'frontend') -Recurse -Force
Copy-Item (Join-Path $repo 'frontend') (Join-Path $workspace 'frontend') -Recurse -Force

Push-Location $workspace
try {
  npm install --prefix frontend
  npm run build --prefix frontend
  native validate app.json
  native build
  native package --target windows --assets frontend/dist

  $exe = Join-Path $workspace 'zig-out/bin/windows-3d-viewer.exe'
  if (Test-Path $exe) {
    Copy-Item $exe (Join-Path $outputDir 'windows-3d-viewer.exe') -Force
  }

  $packageDir = Join-Path $workspace 'zig-out/package'
  $zip = Join-Path $outputDir 'windows-3d-viewer-windows-x64.zip'
  if (Test-Path $zip) { Remove-Item $zip -Force }
  if (Test-Path $packageDir) {
    Compress-Archive -Path (Join-Path $packageDir '*') -DestinationPath $zip -Force
  }

  Write-Host "Build artifacts: $outputDir"
}
finally {
  Pop-Location
}
