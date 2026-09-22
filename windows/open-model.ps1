param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$ModelPath
)

$ErrorActionPreference = 'Stop'

$packageRoot = Split-Path -Parent $PSScriptRoot
if (Test-Path (Join-Path $PSScriptRoot 'bin/windows-3d-viewer.exe')) {
  # When this script is copied to the package root, PSScriptRoot already is the package root.
  $packageRoot = $PSScriptRoot
}

$exe = Join-Path $packageRoot 'bin/windows-3d-viewer.exe'
$frontendRoot = Join-Path $packageRoot 'resources/frontend/dist'
$stageRoot = Join-Path $frontendRoot '__open__'
$launchManifest = Join-Path $stageRoot 'launch.json'

if (-not (Test-Path -LiteralPath $exe)) { throw "Viewer executable not found: $exe" }
if (-not (Test-Path -LiteralPath $frontendRoot)) { throw "Viewer frontend not found: $frontendRoot" }
if (-not (Test-Path -LiteralPath $ModelPath)) { throw "Model file not found: $ModelPath" }

$model = Get-Item -LiteralPath $ModelPath
$sourceRoot = $model.Directory.FullName

if (Test-Path -LiteralPath $stageRoot) {
  Remove-Item -LiteralPath $stageRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null

# Copy the requested model first so it is always the primary file. Related
# sidecar assets are staged with their relative folder structure so glTF,
# OBJ/MTL, FBX, DAE and 3DS references keep resolving normally.
$primaryDestination = Join-Path $stageRoot $model.Name
Copy-Item -LiteralPath $model.FullName -Destination $primaryDestination -Force

$assetExtensions = @(
  '.bin', '.mtl',
  '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tga', '.dds', '.ktx2',
  '.gif', '.hdr', '.exr'
)

$manifestFiles = [System.Collections.Generic.List[string]]::new()
$manifestFiles.Add($model.Name)

Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object {
    $_.FullName -ne $model.FullName -and
    $assetExtensions -contains $_.Extension.ToLowerInvariant()
  } |
  ForEach-Object {
    $relative = [System.IO.Path]::GetRelativePath($sourceRoot, $_.FullName)
    $destination = Join-Path $stageRoot $relative
    $destinationDirectory = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
    $manifestFiles.Add(($relative -replace '\\', '/'))
  }

$manifest = [ordered]@{
  primary = $model.Name
  files = @($manifestFiles)
  createdUtc = [DateTime]::UtcNow.ToString('o')
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $launchManifest -Encoding UTF8 -NoNewline

Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe)
