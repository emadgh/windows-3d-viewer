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

function basenameOf(path) {
  return String(path).replace(/\\/g, '/').split('/').pop();
}

async function waitForNativeBridge(timeoutMs = 8000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if (window.zero?.invoke) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

function decodeBase64(value) {
  const binary = atob(value || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function readNativeFile(relativePath, onProgress) {
  const parts = [];
  let offset = 0;
  let iterations = 0;

  while (true) {
    const chunk = await window.zero.invoke('app.readLaunchFileChunk', {
      path: relativePath,
      offset,
    });

    const bytes = decodeBase64(chunk?.data);
    if (bytes.length) parts.push(bytes);
    if (bytes.length) onProgress?.(bytes.length);

    if (chunk?.eof) break;
    const nextOffset = Number(chunk?.nextOffset);
    if (!Number.isFinite(nextOffset) || nextOffset <= offset) {
      throw new Error(`Invalid chunk response while reading ${relativePath}`);
    }

    offset = nextOffset;
    iterations += 1;
    if (iterations > 200000) throw new Error(`Too many chunks while reading ${relativePath}`);
  }

  const name = basenameOf(relativePath);
  const type = MODEL_MIME_TYPES[extensionOf(name)] || '';
  const file = new File(parts, name, { type, lastModified: Date.now() });

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
    await window.zero.invoke('app.consumeLaunchRequest', {});
  } catch (error) {
    console.warn('Could not consume launch request.', error);
  }
}

let launchOpenInFlight = false;

async function openNativeLaunchFile() {
  if (launchOpenInFlight) return;
  launchOpenInFlight = true;

  try {
    await openNativeLaunchFileInternal();
  } finally {
    launchOpenInFlight = false;
  }
}

async function openNativeLaunchFileInternal() {
  if (!(await waitForNativeBridge())) return;

  let manifest;
  try {
    manifest = await window.zero.invoke('app.getLaunchManifest', {});
  } catch (error) {
    console.warn('Could not query launch request.', error);
    return;
  }

  if (!manifest?.primary || !Array.isArray(manifest.files) || !manifest.files.length) return;

  try {
    const totalBytes = Number(manifest.totalBytes) || 0;
    let bytesRead = 0;
    setNativeOpenStatus(`Preparing ${manifest.primary}…`);

    const orderedPaths = [
      manifest.primary,
      ...manifest.files.filter((path) => path !== manifest.primary),
    ];
    const files = [];

    for (const relativePath of orderedPaths) {
      files.push(await readNativeFile(relativePath, (count) => {
        bytesRead += count;
        if (totalBytes > 0) {
          const percent = Math.min(100, Math.round((bytesRead / totalBytes) * 100));
          setNativeOpenStatus(`Preparing ${manifest.primary}… ${percent}%`);
        }
      }));
    }

    if (typeof window.__w3dvLoadFiles !== 'function') {
      throw new Error('Viewer file loader is unavailable.');
    }

    await window.__w3dvLoadFiles(files);
    await consumeLaunchRequest();
  } catch (error) {
    console.error('Could not open model supplied by Windows Explorer.', error);
    const status = document.querySelector('#statusText');
    if (status) status.textContent = `Could not open associated file: ${error?.message || error}`;
  }
}

function setNativeOpenStatus(message) {
  for (const selector of ['#statusText', '#viewportBadge']) {
    const element = document.querySelector(selector);
    if (element) element.textContent = message;
  }
}

window.__w3dvShowNativeOpenStatus = (fileName) => {
  setNativeOpenStatus(`Preparing ${fileName}…`);
};

window.__w3dvOpenNativeLaunchFile = openNativeLaunchFile;

function scheduleNativeLaunchFile() {
  setTimeout(openNativeLaunchFile, 0);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', scheduleNativeLaunchFile, { once: true });
} else {
  scheduleNativeLaunchFile();
}
