# Windows 3D Viewer

A lightweight Windows desktop 3D file viewer with a Rust native host and an embedded Vite/Three.js frontend.

The distributable is a single `windows-3d-viewer.exe`. The production frontend, Draco decoder, Basis/KTX2 decoder and WebView host code are compiled into the executable; there is no application `resources` directory and no separate `WebView2Loader.dll` to ship.

## Features

- Local file loading by file picker or drag-and-drop
- Open supported models directly from Windows Explorer / Default Apps
- Multi-file loading for external textures, `.bin`, and `.mtl` dependencies
- Formats: GLB, GLTF, FBX, OBJ/MTL, STL, PLY, DAE, 3MF, 3DS, USDZ, VRML/WRL
- glTF Draco, Meshopt, and KTX2/Basis decoding
- Fluid orbit camera with damping, pan, zoom, fit, reset, and double-click focus
- Display modes: Textured + Lighting, Textured (unlit), Clay, Wireframe
- Independent wireframe overlay toggle
- Default environment/key/fill lighting with lighting toggle
- Soft shadows with shadow toggle
- Grid, axes, and auto-rotate toggles
- Scene/object list with visibility, isolate, focus, and search
- Animation clip selection, play/pause, and restart
- Mesh/vertex/triangle/animation statistics
- PNG viewport screenshot

## Stack

- Rust native host
- Wry `0.57` / Windows WebView2
- Tao `0.37`
- `rust-embed` for compiling the production frontend into the EXE
- Three.js `0.186.0`
- Vite `8.3.0`

The web application under `frontend/` remains independent of the native host. The Rust WebView injects a small compatibility bridge implementing the existing `window.zero.invoke(...)` interface, so the frontend does not depend on Rust-specific APIs.

## Development

Requirements:

- Windows 10/11
- Microsoft Edge WebView2 Runtime
- Rust stable with the MSVC toolchain
- Node.js 24+

Run:

```powershell
./scripts/dev.ps1
```

The development script builds the frontend and starts the Rust host with `cargo run`.

## Windows release build

```powershell
./scripts/build-windows.ps1
```

The only distributable written to `dist/` is:

```text
dist/windows-3d-viewer.exe
```

The release target is `x86_64-pc-windows-msvc`. Wry/WebView2 uses the MSVC static WebView2 loader, so `WebView2Loader.dll` does not need to sit beside the executable.

## Opening models from Explorer

The Settings dialog can register Windows 3D Viewer for the supported file formats. Windows still requires the user to confirm the final default-app selection in Default Apps.

The registered shell command launches the EXE directly with the selected file path:

```text
"windows-3d-viewer.exe" "%1"
```

No PowerShell launcher or temporary launch manifest is required. Rust reads the selected model directly and exposes the model plus related sidecar files to the existing frontend through the native bridge.

## Loading models with external files

For a model opened from Explorer, the Rust host makes common sidecar assets from the model directory tree available to the frontend, including `.bin`, `.mtl`, image textures, DDS, KTX2, HDR and EXR files.

For files selected or dropped inside the viewer, the existing frontend loading behavior remains unchanged.

## Architecture

The repository intentionally separates the two layers:

- `src/main.rs` — Rust window/WebView host, native bridge, file associations and model-file access
- `frontend/` — unchanged Vite/Three.js viewer UI and rendering code

The previous Zig / Native SDK host, Native SDK manifests and PowerShell association launcher have been removed.
