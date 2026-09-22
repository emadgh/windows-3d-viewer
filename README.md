# Windows 3D Viewer

A Windows desktop 3D file viewer built with [Native SDK](https://native-sdk.dev/) for the native shell and WebView2 hosting, with [Three.js](https://threejs.org/) for 3D rendering.

## Features

- Local file loading by file picker or drag-and-drop
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

- Native SDK `0.9.4`
- Windows system WebView2 backend
- Three.js `0.186.0`
- Vite `8.3.0`

The repository keeps the application-specific source small and reproducible. The PowerShell scripts ask the Native SDK CLI to scaffold the matching Vite/WebView native shell into `.native-workspace/`, replace its frontend and manifest with this repository's source, then run the normal Native SDK build/package commands. This avoids committing a generated `build.zig` that can drift from the installed Native SDK version.

## Development

Requirements:

- Windows 10/11
- Node.js 24+
- Native SDK CLI: `npm install -g @native-sdk/cli@0.9.4`
- Zig 0.16.0 (or let Native SDK manage its pinned toolchain)

Run:

```powershell
./scripts/dev.ps1
```

## Windows release build

```powershell
./scripts/build-windows.ps1
```

Artifacts are written to `dist/`:

- `windows-3d-viewer.exe`
- `windows-3d-viewer-windows-x64.zip` (packaged Native SDK output, including the WebView support files)

## Loading models with external files

For formats that reference external resources, select or drop the model together with its related files in one operation. For example:

- `scene.gltf` + `scene.bin` + texture images
- `model.obj` + `model.mtl` + texture images
- `model.fbx` + external texture images

The viewer maps dependency requests back to the selected local files by relative path and file name.

## Notes

The Windows package uses the system WebView2 runtime. Current Windows 10/11 installations normally have the Evergreen WebView2 runtime; Native SDK packages its required loader alongside the app.
