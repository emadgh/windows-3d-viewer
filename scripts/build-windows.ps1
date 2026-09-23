$ErrorActionPreference = 'Stop'

$repo = Resolve-Path (Join-Path $PSScriptRoot '..')
$outputDir = Join-Path $repo 'dist'
$target = 'x86_64-pc-windows-msvc'

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  throw 'Rust/Cargo is not installed.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'Node.js/npm is not installed.'
}

if (-not (Test-Path -LiteralPath $outputDir -PathType Container)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
} else {
  foreach ($name in @(
    'windows-3d-viewer.exe',
    'windows-3d-viewer.exe.sha256',
    '3D Viewer.exe',
    '3D Viewer.exe.sha256'
  )) {
    $oldBuildFile = Join-Path $outputDir $name
    if (Test-Path -LiteralPath $oldBuildFile -PathType Leaf) {
      Remove-Item -LiteralPath $oldBuildFile -Force
    }
  }
}

Push-Location $repo
try {
  npm install --prefix frontend
  if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }

  npm run build --prefix frontend
  if ($LASTEXITCODE -ne 0) { throw 'Frontend Vite build failed.' }

  rustup target add $target | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "Could not install Rust target $target." }

  cargo build --release --target $target
  if ($LASTEXITCODE -ne 0) { throw 'Rust release build failed.' }

  $builtExe = Join-Path $repo "target/$target/release/viewer-3d.exe"
  if (-not (Test-Path -LiteralPath $builtExe)) {
    throw "Expected Rust executable was not created: $builtExe"
  }

  $singleExe = Join-Path $outputDir '3D Viewer.exe'
  Copy-Item -LiteralPath $builtExe -Destination $singleExe -Force

  $exeBytes = [IO.File]::ReadAllBytes($singleExe)
  $peOffset = [BitConverter]::ToInt32($exeBytes, 0x3c)
  $subsystem = [BitConverter]::ToUInt16($exeBytes, $peOffset + 24 + 68)
  if ($subsystem -ne 2) {
    throw "Expected a Windows GUI executable (PE subsystem 2), got subsystem $subsystem."
  }

  $files = @(Get-ChildItem -LiteralPath $outputDir -File)
  if ($files.Count -ne 1 -or $files[0].Name -ne '3D Viewer.exe') {
    throw 'dist must contain exactly one distributable file: 3D Viewer.exe'
  }

  Write-Host "Single-file Rust Windows GUI executable: $singleExe"
  Write-Host "Size: $((Get-Item $singleExe).Length) bytes"
}
finally {
  Pop-Location
}
