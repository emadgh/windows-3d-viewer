const MODEL_MIME_TYPES = {
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  obj: 'model/obj',
  stl: 'model/stl',
  ply: 'application/octet-stream',
  fbx: 'application/octet-stream',
  dae: 'model/vnd.collada+xml',
  '3mf': 'model/3mf',
  '3ds': 'application/octet-stream',
  usdz: 'model/vnd.usdz+zip',
  wrl: 'model/vrml',
  vrml: 'model/vrml',
};

function extensionOf(name) {
  const index = String(name).lastIndexOf('.');
  return index >= 0 ? String(name).slice(index + 1).toLowerCase() : '';
}

function encodedRelativeUrl(relativePath) {
  const safePath = String(relativePath)
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return new URL(`./__open__/${safePath}`, document.baseURI);
}

async function stagedFile(relativePath) {
  const response = await fetch(encodedRelativeUrl(relativePath), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not read staged file: ${relativePath}`);
  const blob = await response.blob();
  const basename = String(relativePath).replace(/\\/g, '/').split('/').pop();
  const type = blob.type || MODEL_MIME_TYPES[extensionOf(basename)] || '';
  const file = new File([blob], basename, { type, lastModified: Date.now() });

  // The existing viewer uses webkitRelativePath when present to resolve
  // glTF/OBJ/DAE sidecars. Chromium permits defining it on synthetic Files.
  try {
    Object.defineProperty(file, 'webkitRelativePath', {
      configurable: true,
      value: String(relativePath).replace(/\\/g, '/'),
    });
  } catch {
    // Basename resolution remains available in the viewer as a fallback.
  }

  return file;
}

async function consumeLaunchRequest() {
  try {
    await window.zero?.invoke?.('app.consumeLaunchRequest');
  } catch (error) {
    console.warn('Could not consume launch request.', error);
  }
}

async function openStagedLaunchFile() {
  let response;
  try {
    response = await fetch(new URL('./__open__/launch.json', document.baseURI), { cache: 'no-store' });
  } catch {
    return;
  }

  if (!response.ok) return;

  try {
    const manifest = await response.json();
    if (!manifest?.primary || !Array.isArray(manifest.files) || !manifest.files.length) return;

    const orderedPaths = [
      manifest.primary,
      ...manifest.files.filter((path) => path !== manifest.primary),
    ];
    const files = [];
    for (const relativePath of orderedPaths) {
      files.push(await stagedFile(relativePath));
    }

    const input = document.querySelector('#fileInput');
    if (!input) throw new Error('Viewer file input is unavailable.');

    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await consumeLaunchRequest();
  } catch (error) {
    console.error('Could not open model supplied by Windows Explorer.', error);
    const status = document.querySelector('#statusText');
    if (status) status.textContent = `Could not open associated file: ${error?.message || error}`;
  }
}

window.addEventListener('load', () => {
  setTimeout(openStagedLaunchFile, 0);
}, { once: true });
