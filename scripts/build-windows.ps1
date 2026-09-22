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

if (Test-Path $outputDir) { Remove-Item $outputDir -Recurse -Force }
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

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

  $builtExe = Join-Path $repo "target/$target/release/windows-3d-viewer.exe"
  if (-not (Test-Path -LiteralPath $builtExe)) {
    throw "Expected Rust executable was not created: $builtExe"
  }

  $singleExe = Join-Path $outputDir 'windows-3d-viewer.exe'
  Copy-Item -LiteralPath $builtExe -Destination $singleExe -Force

  $files = @(Get-ChildItem -LiteralPath $outputDir -File)
  if ($files.Count -ne 1 -or $files[0].Name -ne 'windows-3d-viewer.exe') {
    throw 'dist must contain exactly one distributable file: windows-3d-viewer.exe'
  }

  Write-Host "Single-file Rust Windows executable: $singleExe"
  Write-Host "Size: $((Get-Item $singleExe).Length) bytes"
}
finally {
  Pop-Location
}
