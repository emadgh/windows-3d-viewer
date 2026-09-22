$ErrorActionPreference = 'Stop'

$repo = Resolve-Path (Join-Path $PSScriptRoot '..')

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  throw 'Rust/Cargo is not installed.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'Node.js/npm is not installed.'
}

Push-Location $repo
try {
  npm install --prefix frontend
  if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }

  npm run build --prefix frontend
  if ($LASTEXITCODE -ne 0) { throw 'Frontend Vite build failed.' }

  cargo run
}
finally {
  Pop-Location
}
