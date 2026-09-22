param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Executable,

  [Parameter(Mandatory = $true, Position = 1)]
  [string]$ModelPath,

  [switch]$NoStart
)

$ErrorActionPreference = 'Stop'

$stageRoot = Join-Path $env:LOCALAPPDATA 'Windows3DViewer\launch-cache'
$launchManifest = Join-Path $stageRoot 'launch.json'

if (-not (Test-Path -LiteralPath $Executable)) { throw "Viewer executable not found: $Executable" }
if (-not (Test-Path -LiteralPath $ModelPath)) { throw "Model file not found: $ModelPath" }

$exe = (Get-Item -LiteralPath $Executable).FullName
$model = Get-Item -LiteralPath $ModelPath
$sourceRoot = $model.Directory.FullName.TrimEnd('\', '/')

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

$manifestFiles = New-Object 'System.Collections.Generic.List[string]'
$manifestFiles.Add($model.Name)

Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object {
    $_.FullName -ne $model.FullName -and
    $assetExtensions -contains $_.Extension.ToLowerInvariant()
  } |
  ForEach-Object {
    # Avoid System.IO.Path.GetRelativePath, which is unavailable in the
    # .NET Framework used by Windows PowerShell 5.1 on many Windows 10/11 PCs.
    $relative = $_.FullName.Substring($sourceRoot.Length).TrimStart('\', '/')
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
$json = $manifest | ConvertTo-Json -Depth 4
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($launchManifest, $json, $utf8NoBom)

if (-not $NoStart) {
  Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe)
}
