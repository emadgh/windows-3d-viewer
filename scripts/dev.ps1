$ErrorActionPreference = 'Stop'

$repo = Resolve-Path (Join-Path $PSScriptRoot '..')
$workspaceRoot = Join-Path $repo '.native-workspace'
$workspace = Join-Path $workspaceRoot 'windows-3d-viewer'

if (-not (Get-Command native -ErrorAction SilentlyContinue)) {
  throw 'Native SDK CLI is not installed. Run: npm install -g @native-sdk/cli@0.9.4'
}

if (Test-Path $workspace) { Remove-Item $workspace -Recurse -Force }
New-Item -ItemType Directory -Path $workspaceRoot -Force | Out-Null

native init $workspace --frontend vite
Copy-Item (Join-Path $repo 'app.json') (Join-Path $workspace 'app.json') -Force
Remove-Item (Join-Path $workspace 'frontend') -Recurse -Force
Copy-Item (Join-Path $repo 'frontend') (Join-Path $workspace 'frontend') -Recurse -Force

Push-Location $workspace
try {
  npm install --prefix frontend
  native validate app.json
  native dev
}
finally {
  Pop-Location
}
