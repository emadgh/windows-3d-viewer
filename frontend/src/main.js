import './style.css';
import './startup-file.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { TDSLoader } from 'three/addons/loaders/TDSLoader.js';
import { USDZLoader } from 'three/addons/loaders/USDZLoader.js';
import { VRMLLoader } from 'three/addons/loaders/VRMLLoader.js';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import { DDSLoader } from 'three/addons/loaders/DDSLoader.js';

const MODEL_EXTENSIONS = new Set(['glb', 'gltf', 'fbx', 'obj', 'stl', 'ply', 'dae', '3mf', '3ds', 'usdz', 'wrl', 'vrml']);
const DEFAULT_CLAY_COLOR = '#787878';
const modeLabels = {
  'textured-lighting': 'Textured + Lighting',
  textured: 'Textured',
  clay: 'Clay',
  wireframe: 'Wireframe',
};

const ui = {
  viewport: document.querySelector('#viewport'),
  openButton: document.querySelector('#openButton'),
  emptyOpenButton: document.querySelector('#emptyOpenButton'),
  fileInput: document.querySelector('#fileInput'),
  fitButton: document.querySelector('#fitButton'),
  resetButton: document.querySelector('#resetButton'),
  screenshotButton: document.querySelector('#screenshotButton'),
  modeSelect: document.querySelector('#modeSelect'),
  clayColorControl: document.querySelector('#clayColorControl'),
  clayColor: document.querySelector('#clayColor'),
  lightingToggle: document.querySelector('#lightingToggle'),
  shadowsToggle: document.querySelector('#shadowsToggle'),
  wireToggle: document.querySelector('#wireToggle'),
  gridToggle: document.querySelector('#gridToggle'),
  axesToggle: document.querySelector('#axesToggle'),
  autorotateToggle: document.querySelector('#autorotateToggle'),
  boundsToggleButton: document.querySelector('#boundsToggleButton'),
  scalePersonToggleButton: document.querySelector('#scalePersonToggleButton'),
  boundsTarget: document.querySelector('#boundsTarget'),
  dimensionX: document.querySelector('#dimensionX'),
  dimensionY: document.querySelector('#dimensionY'),
  dimensionZ: document.querySelector('#dimensionZ'),
  boundsScale: document.querySelector('#boundsScale'),
  transformPanel: document.querySelector('#transformPanel'),
  transformEnabled: document.querySelector('#transformEnabled'),
  transformModeButtons: Array.from(document.querySelectorAll('[data-transform-mode]')),
  transformSpace: document.querySelector('#transformSpace'),
  transformPivot: document.querySelector('#transformPivot'),
  unifiedScaleToggle: document.querySelector('#unifiedScaleToggle'),
  transformPositionX: document.querySelector('#transformPositionX'),
  transformPositionY: document.querySelector('#transformPositionY'),
  transformPositionZ: document.querySelector('#transformPositionZ'),
  transformRotationX: document.querySelector('#transformRotationX'),
  transformRotationY: document.querySelector('#transformRotationY'),
  transformRotationZ: document.querySelector('#transformRotationZ'),
  transformScaleX: document.querySelector('#transformScaleX'),
  transformScaleY: document.querySelector('#transformScaleY'),
  transformScaleZ: document.querySelector('#transformScaleZ'),
  resetTransformButton: document.querySelector('#resetTransformButton'),
  saveButton: document.querySelector('#saveButton'),
  saveAsButton: document.querySelector('#saveAsButton'),
  transformState: document.querySelector('#transformState'),
  precisionAlignButton: document.querySelector('#precisionAlignButton'),
  precisionAlignOverlay: document.querySelector('#precisionAlignOverlay'),
  precisionAlignSvg: document.querySelector('#precisionAlignSvg'),
  alignXLine: document.querySelector('#alignXLine'),
  alignYLine: document.querySelector('#alignYLine'),
  alignX1: document.querySelector('#alignX1'),
  alignX2: document.querySelector('#alignX2'),
  alignY1: document.querySelector('#alignY1'),
  alignY2: document.querySelector('#alignY2'),
  alignXLabel: document.querySelector('#alignXLabel'),
  alignYLabel: document.querySelector('#alignYLabel'),
  alignXAngle: document.querySelector('#alignXAngle'),
  alignYAngle: document.querySelector('#alignYAngle'),
  alignCorrection: document.querySelector('#alignCorrection'),
  alignAxisError: document.querySelector('#alignAxisError'),
  alignHitStatus: document.querySelector('#alignHitStatus'),
  alignResetButton: document.querySelector('#alignResetButton'),
  alignCancelButton: document.querySelector('#alignCancelButton'),
  alignConfirmButton: document.querySelector('#alignConfirmButton'),
  emptyState: document.querySelector('#emptyState'),
  viewportBadge: document.querySelector('#viewportBadge'),
  modelName: document.querySelector('#modelName'),
  meshCount: document.querySelector('#meshCount'),
  vertexCount: document.querySelector('#vertexCount'),
  triangleCount: document.querySelector('#triangleCount'),
  animationCount: document.querySelector('#animationCount'),
  animationPanel: document.querySelector('#animationPanel'),
  animationSelect: document.querySelector('#animationSelect'),
  playPauseButton: document.querySelector('#playPauseButton'),
  restartAnimationButton: document.querySelector('#restartAnimationButton'),
  objectTree: document.querySelector('#objectTree'),
  treeSearch: document.querySelector('#treeSearch'),
  clearIsolationButton: document.querySelector('#clearIsolationButton'),
  statusText: document.querySelector('#statusText'),
  formatText: document.querySelector('#formatText'),
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b2129);

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100000);
camera.position.set(3.2, 2.3, 4.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
ui.viewport.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.rotateSpeed = 0.62;
controls.zoomSpeed = 0.85;
controls.panSpeed = 0.72;
controls.screenSpacePanning = true;
controls.target.set(0, 0, 0);
controls.update();

const transformControls = new TransformControls(camera, renderer.domElement);
const transformPivotProxy = new THREE.Object3D();
transformPivotProxy.name = '__viewer_transform_pivot__';
transformPivotProxy.userData.viewerHelper = true;
scene.add(transformPivotProxy);
const transformHelper = transformControls.getHelper();
transformHelper.visible = false;
transformHelper.userData.viewerHelper = true;
scene.add(transformHelper);

let transformDragState = null;
transformControls.addEventListener('mouseDown', () => {
  controls.enabled = false;
  beginTransformProxyDrag();
});
transformControls.addEventListener('mouseUp', () => {
  finishTransformProxyDrag();
  controls.enabled = true;
  refreshScalePersonAnchor();
  if (glbTransformEnabled) syncTransformPivotProxy();
});
transformControls.addEventListener('objectChange', () => {
  applyTransformProxyDelta();
  updateTransformFields();
  updateGlbTransformState();
  updateBoundsMeasurement();
  positionScalePersonReference();
});

const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environmentTexture = pmrem.fromScene(room, 0.04).texture;
room.dispose();
pmrem.dispose();
scene.environment = environmentTexture;

const hemisphere = new THREE.HemisphereLight(0xeaf2ff, 0x39404a, 1.35);
scene.add(hemisphere);

const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
keyLight.position.set(4, 6, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.00025;
keyLight.shadow.normalBias = 0.03;
scene.add(keyLight);
scene.add(keyLight.target);

const fillLight = new THREE.DirectionalLight(0xabc7ff, 0.65);
fillLight.position.set(-4, 2, -2);
scene.add(fillLight);

let grid = new THREE.GridHelper(10, 20, 0x6f7d90, 0x3a4452);
grid.material.transparent = true;
grid.material.opacity = 0.38;
scene.add(grid);

const axes = new THREE.AxesHelper(1);
axes.visible = false;
scene.add(axes);

const boundsBox = new THREE.Box3();
const boundsHelper = new THREE.Box3Helper(boundsBox, 0x79a3ff);
boundsHelper.visible = false;
boundsHelper.renderOrder = 100;
boundsHelper.userData.viewerHelper = true;
boundsHelper.material.transparent = true;
boundsHelper.material.opacity = 0.95;
boundsHelper.material.depthTest = false;
boundsHelper.material.depthWrite = false;
scene.add(boundsHelper);

const scalePersonTexture = new THREE.TextureLoader().load(
  new URL('./scale-person-175.svg', document.baseURI).href,
  () => positionScalePersonReference(),
);
scalePersonTexture.colorSpace = THREE.SRGBColorSpace;
scalePersonTexture.minFilter = THREE.LinearFilter;
scalePersonTexture.magFilter = THREE.LinearFilter;

const scalePersonMaterial = new THREE.SpriteMaterial({
  map: scalePersonTexture,
  transparent: true,
  opacity: 0.84,
  depthTest: true,
  depthWrite: false,
  toneMapped: false,
});
const scalePersonSprite = new THREE.Sprite(scalePersonMaterial);
scalePersonSprite.name = '__viewer_scale_person_175__';
scalePersonSprite.userData.viewerHelper = true;
// SVG viewBox is 1:2. The actual human spans y=15..190, exactly 175/200
// of the image, so a 2.0 m sprite produces an exact 1.75 m human figure.
scalePersonSprite.scale.set(1, 2, 1);
scalePersonSprite.visible = false;
scalePersonSprite.renderOrder = 15;
scene.add(scalePersonSprite);

const groundMaterial = new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.24, transparent: true });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.renderOrder = -2;
scene.add(ground);

const wireOverlayMaterial = new THREE.LineBasicMaterial({ color: 0x10151c, transparent: true, opacity: 0.5, depthTest: true });

const manager = new THREE.LoadingManager();
manager.addHandler(/\.tga$/i, new TGALoader(manager));
manager.addHandler(/\.dds$/i, new DDSLoader(manager));

let currentModel = null;
let currentAnimations = [];
let mixer = null;
let activeAction = null;
let animationPlaying = false;
let currentFileName = '';
let currentMode = 'textured-lighting';
let clayColor = DEFAULT_CLAY_COLOR;
let lightingEnabled = true;
let shadowsEnabled = true;
let wireOverlayEnabled = false;
let activeBlobUrls = [];
let assetUrlMap = new Map();
let isolationTarget = null;
let visibilitySnapshot = null;
let treeRows = [];
let lastModelBounds = null;
let boundsVisible = false;
let glbTransformEnabled = false;
let originalGlbTransform = null;
let transformPivotMode = 'center';
let unifiedScaleEnabled = false;
let glbExportInProgress = false;
let currentGlbSaveHandle = null;
let currentGlbNativeSource = false;
let scalePersonVisible = true;
let scalePersonAnchor = null;
let precisionAlignActive = false;
let precisionAlignDrag = null;
let precisionAlignAutoRotateWasEnabled = false;
let precisionSurfaceSample = null;
const precisionRaycaster = new THREE.Raycaster();
const precisionGuides = {
  x: { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } },
  y: { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } },
};
const clock = new THREE.Clock();

manager.setURLModifier((url) => resolveLocalAsset(url));
manager.onStart = () => setStatus('Loading assets…');
manager.onProgress = (_url, loaded, total) => {
  if (total > 0) setStatus(`Loading assets… ${loaded}/${total}`);
};
manager.onError = (url) => setStatus(`Could not load dependency: ${shortenUrl(url)}`, true);

function setStatus(text, isError = false) {
  ui.statusText.textContent = text;
  ui.viewportBadge.textContent = text;
  ui.viewportBadge.style.color = isError ? '#ff9c9c' : '';
}

function shortenUrl(url) {
  try {
    const clean = decodeURIComponent(String(url).split('?')[0].split('#')[0]);
    return clean.split(/[\\/]/).pop() || clean;
  } catch {
    return String(url);
  }
}

function getExtension(name) {
  const match = String(name).toLowerCase().match(/\.([^.]+)$/);
  return match ? match[1] : '';
}

function normalizePath(value) {
  try { value = decodeURIComponent(value); } catch { /* keep original */ }
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '').split(/[?#]/)[0].toLowerCase();
}

function resolveLocalAsset(url) {
  if (!assetUrlMap.size) return url;
  const normalized = normalizePath(url);
  const basename = normalized.split('/').pop();
  if (assetUrlMap.has(normalized)) return assetUrlMap.get(normalized);
  if (basename && assetUrlMap.has(basename)) return assetUrlMap.get(basename);
  for (const [key, value] of assetUrlMap) {
    if (normalized.endsWith(`/${key}`)) return value;
  }
  return url;
}

function releaseBlobUrls() {
  for (const url of activeBlobUrls) URL.revokeObjectURL(url);
  activeBlobUrls = [];
  assetUrlMap = new Map();
}

function prepareLocalAssets(files) {
  releaseBlobUrls();
  const nextMap = new Map();
  for (const file of files) {
    const url = URL.createObjectURL(file);
    activeBlobUrls.push(url);
    const relative = normalizePath(file.webkitRelativePath || file.name);
    const basename = normalizePath(file.name);
    if (!nextMap.has(relative)) nextMap.set(relative, url);
    if (!nextMap.has(basename)) nextMap.set(basename, url);
  }
  assetUrlMap = nextMap;
}

function findPrimaryFile(files) {
  return files.find((file) => MODEL_EXTENSIONS.has(getExtension(file.name))) || null;
}

async function loadFiles(fileList, options = {}) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const primary = findPrimaryFile(files);
  if (!primary) {
    setStatus('No supported 3D model found in the selected files.', true);
    return;
  }

  clearCurrentModel();
  currentGlbSaveHandle = options.saveHandle && getExtension(primary.name) === 'glb'
    ? options.saveHandle
    : null;
  currentGlbNativeSource = Boolean(options.nativeSource && getExtension(primary.name) === 'glb');
  if (!options.nativeSource && window.zero?.invoke) {
    try {
      await window.zero.invoke('app.clearActiveSource', {});
    } catch (error) {
      console.warn('Could not clear native save target.', error);
    }
  }
  prepareLocalAssets(files);
  currentFileName = primary.name;
  ui.modelName.textContent = primary.name;
  ui.formatText.textContent = getExtension(primary.name).toUpperCase();
  ui.emptyState.hidden = true;
  setStatus(`Opening ${primary.name}…`);

  try {
    const result = await loadModel(primary, files);
    if (!result?.object) throw new Error('The loader did not return a scene object.');
    installModel(result.object, result.animations || [], primary.name);
    setStatus(`${primary.name} loaded`);
  } catch (error) {
    console.error(error);
    setStatus(`Failed to open ${primary.name}: ${error?.message || error}`, true);
    ui.emptyState.hidden = false;
    ui.modelName.textContent = 'No model loaded';
    ui.formatText.textContent = 'Load failed';
  }
}

async function openWithFileSystemPicker() {
  if (typeof window.showOpenFilePicker !== 'function') {
    ui.fileInput.click();
    return;
  }

  try {
    const handles = await window.showOpenFilePicker({
      multiple: true,
      types: [{
        description: '3D models and related files',
        accept: {
          'application/octet-stream': [
            '.glb', '.gltf', '.fbx', '.obj', '.mtl', '.stl', '.ply', '.dae',
            '.3mf', '.3ds', '.usdz', '.wrl', '.vrml', '.bin', '.tga', '.dds', '.ktx2',
            '.png', '.jpg', '.jpeg', '.webp', '.bmp',
          ],
        },
      }],
    });
    const files = await Promise.all(handles.map((handle) => handle.getFile()));
    const primary = findPrimaryFile(files);
    const primaryIndex = primary ? files.indexOf(primary) : -1;
    const saveHandle = primaryIndex >= 0 && getExtension(primary.name) === 'glb'
      ? handles[primaryIndex]
      : null;
    await loadFiles(files, { saveHandle });
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.warn('System file picker failed; using the fallback picker.', error);
      ui.fileInput.click();
    }
  }
}

// The native launch bridge calls this directly for Explorer/open-with files.
// Keeping the loader independent from the hidden file input avoids WebView2
// differences when assigning synthetic files to HTMLInputElement.files.
window.__w3dvLoadFiles = loadFiles;

async function loadModel(primary, files) {
  const ext = getExtension(primary.name);
  const sourceUrl = assetUrlMap.get(normalizePath(primary.name));
  if (!sourceUrl) throw new Error('Could not create a local URL for the model.');

  switch (ext) {
    case 'glb':
    case 'gltf': {
      const draco = new DRACOLoader(manager);
      const ktx2 = new KTX2Loader(manager);
      draco.setDecoderPath(new URL('./draco/gltf/', document.baseURI).href);
      draco.preload();
      ktx2.setTranscoderPath(new URL('./basis/', document.baseURI).href);
      ktx2.detectSupport(renderer);
      const loader = new GLTFLoader(manager);
      loader.setDRACOLoader(draco);
      loader.setKTX2Loader(ktx2);
      loader.setMeshoptDecoder(MeshoptDecoder);
      try {
        const gltf = await loader.loadAsync(sourceUrl);
        return { object: gltf.scene, animations: gltf.animations || [] };
      } finally {
        draco.dispose();
        ktx2.dispose();
      }
    }
    case 'fbx': {
      const object = await new FBXLoader(manager).loadAsync(sourceUrl);
      return { object, animations: object.animations || [] };
    }
    case 'obj': {
      const objLoader = new OBJLoader(manager);
      const base = primary.name.replace(/\.obj$/i, '').toLowerCase();
      const mtl = files.find((file) => getExtension(file.name) === 'mtl' && file.name.replace(/\.mtl$/i, '').toLowerCase() === base)
        || files.find((file) => getExtension(file.name) === 'mtl');
      if (mtl) {
        const mtlUrl = assetUrlMap.get(normalizePath(mtl.name));
        const materials = await new MTLLoader(manager).loadAsync(mtlUrl);
        materials.preload();
        objLoader.setMaterials(materials);
      }
      return { object: await objLoader.loadAsync(sourceUrl), animations: [] };
    }
    case 'stl': {
      const geometry = await new STLLoader(manager).loadAsync(sourceUrl);
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xb7bec8, roughness: 0.72, metalness: 0.03 }));
      mesh.name = primary.name.replace(/\.stl$/i, '');
      return { object: mesh, animations: [] };
    }
    case 'ply': {
      const geometry = await new PLYLoader(manager).loadAsync(sourceUrl);
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      const hasVertexColors = Boolean(geometry.attributes.color);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xc0c5cd, vertexColors: hasVertexColors, roughness: 0.72, metalness: 0.02 }));
      mesh.name = primary.name.replace(/\.ply$/i, '');
      return { object: mesh, animations: [] };
    }
    case 'dae': {
      const result = await new ColladaLoader(manager).loadAsync(sourceUrl);
      return { object: result.scene, animations: result.animations || result.scene?.animations || [] };
    }
    case '3mf':
      return { object: await new ThreeMFLoader(manager).loadAsync(sourceUrl), animations: [] };
    case '3ds':
      return { object: await new TDSLoader(manager).loadAsync(sourceUrl), animations: [] };
    case 'usdz':
      return { object: await new USDZLoader(manager).loadAsync(sourceUrl), animations: [] };
    case 'wrl':
    case 'vrml':
      return { object: await new VRMLLoader(manager).loadAsync(sourceUrl), animations: [] };
    default:
      throw new Error(`Unsupported model format: .${ext}`);
  }
}

function installModel(object, animations, fileName) {
  currentModel = object;
  currentAnimations = animations;
  currentModel.name ||= fileName;
  scene.add(currentModel);

  currentModel.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.userData.viewerOriginalMaterial = child.material;
    child.userData.viewerMaterialVariants = {};
    addWireOverlay(child);
  });

  configureAnimations();
  configureGlbTransformTools();
  updateModelStats();
  updateStageFromModel();
  updateBoundsMeasurement();
  applyRenderMode(currentMode);
  applyLighting();
  applyShadows();
  updateWireOverlays();
  renderObjectTree();
  fitObject(currentModel, false);
  refreshScalePersonAnchor();
}

function addWireOverlay(mesh) {
  if (!mesh.geometry?.attributes?.position) return;
  try {
    const geometry = new THREE.WireframeGeometry(mesh.geometry);
    const lines = new THREE.LineSegments(geometry, wireOverlayMaterial);
    lines.name = '__viewer_wire_overlay__';
    lines.userData.viewerHelper = true;
    lines.visible = false;
    lines.renderOrder = 50;
    mesh.add(lines);
  } catch (error) {
    console.warn('Wireframe overlay could not be created for mesh', mesh.name, error);
  }
}

function clearCurrentModel() {
  if (precisionAlignActive) stopPrecisionAlign(false);
  scalePersonAnchor = null;
  scalePersonSprite.visible = false;
  setGlbTransformEnabled(false);
  ui.transformPanel.hidden = true;
  originalGlbTransform = null;
  clearIsolation();
  if (mixer) {
    mixer.stopAllAction();
    if (currentModel) mixer.uncacheRoot(currentModel);
  }
  mixer = null;
  activeAction = null;
  currentAnimations = [];
  animationPlaying = false;

  if (currentModel) {
    scene.remove(currentModel);
    disposeModelResources(currentModel);
  }
  currentModel = null;
  lastModelBounds = null;
  boundsBox.makeEmpty();
  boundsHelper.visible = false;
  ui.boundsTarget.textContent = 'No model';
  ui.dimensionX.textContent = '—';
  ui.dimensionY.textContent = '—';
  ui.dimensionZ.textContent = '—';
  ui.boundsScale.textContent = '1 Unity unit = 1 m';
  ui.animationPanel.hidden = true;
  ui.objectTree.innerHTML = '<div class="tree-empty">Open a model to inspect its objects.</div>';
  ui.meshCount.textContent = '—';
  ui.vertexCount.textContent = '—';
  ui.triangleCount.textContent = '—';
  ui.animationCount.textContent = '—';
  renderer.renderLists.dispose();
  ui.saveButton.disabled = true;
  ui.saveAsButton.disabled = true;
}

function disposeModelResources(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  root.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    collectMaterial(child.material, materials, textures);
    collectMaterial(child.userData?.viewerOriginalMaterial, materials, textures);
    const variants = child.userData?.viewerMaterialVariants;
    if (variants) Object.values(variants).forEach((value) => collectMaterial(value, materials, textures));
  });

  geometries.forEach((value) => value?.dispose?.());
  materials.forEach((value) => value?.dispose?.());
  textures.forEach((value) => value?.dispose?.());
}

function collectMaterial(value, materials, textures) {
  if (!value) return;
  const list = Array.isArray(value) ? value : [value];
  for (const material of list) {
    if (!material || materials.has(material) || material === wireOverlayMaterial) continue;
    materials.add(material);
    for (const property of Object.values(material)) {
      if (property?.isTexture) textures.add(property);
    }
  }
}

function updateModelStats() {
  let meshes = 0;
  let vertices = 0;
  let triangles = 0;
  currentModel?.traverse((child) => {
    if (!child.isMesh || child.userData.viewerHelper) return;
    meshes += 1;
    const geometry = child.geometry;
    const position = geometry?.attributes?.position;
    if (position) vertices += position.count;
    if (geometry?.index) triangles += geometry.index.count / 3;
    else if (position) triangles += position.count / 3;
  });
  ui.meshCount.textContent = formatNumber(meshes);
  ui.vertexCount.textContent = formatNumber(Math.round(vertices));
  ui.triangleCount.textContent = formatNumber(Math.round(triangles));
  ui.animationCount.textContent = formatNumber(currentAnimations.length);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function isGlbModel() {
  return Boolean(currentModel) && getExtension(currentFileName) === 'glb';
}

function refreshScalePersonAnchor() {
  if (!currentModel) {
    scalePersonAnchor = null;
    scalePersonSprite.visible = false;
    return;
  }

  currentModel.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(currentModel, true);
  if (box.isEmpty()) {
    scalePersonAnchor = null;
    scalePersonSprite.visible = false;
    return;
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const metersPerUnit = Math.max(getUnityMetersPerUnit(), 1e-9);
  scalePersonAnchor = {
    center,
    floorY: box.min.y,
    metersPerUnit,
    sideOffset: Math.hypot(size.x, size.z) * 0.5 + (0.62 / metersPerUnit),
  };
  positionScalePersonReference();
}

function positionScalePersonReference() {
  if (!scalePersonVisible || !currentModel || !scalePersonAnchor) {
    scalePersonSprite.visible = false;
    return;
  }

  camera.updateMatrixWorld();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  right.y = 0;
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  else right.normalize();

  const unitsPerMeter = 1 / scalePersonAnchor.metersPerUnit;
  scalePersonSprite.scale.set(1 * unitsPerMeter, 2 * unitsPerMeter, 1);
  scalePersonSprite.position.copy(scalePersonAnchor.center).addScaledVector(right, scalePersonAnchor.sideOffset);
  // The flat SVG is 2.0 m high while the person itself spans exactly 1.75 m.
  // Convert meters to source-file units so FBX/3DS and GLB all compare correctly.
  scalePersonSprite.position.y = scalePersonAnchor.floorY + (0.9 * unitsPerMeter);
  scalePersonSprite.visible = true;
}

function setScalePersonVisible(visible) {
  scalePersonVisible = Boolean(visible);
  ui.scalePersonToggleButton.setAttribute('aria-pressed', String(scalePersonVisible));
  ui.scalePersonToggleButton.classList.toggle('active', scalePersonVisible);
  if (scalePersonVisible && !scalePersonAnchor) refreshScalePersonAnchor();
  else positionScalePersonReference();
}

function getTransformPivotWorldPosition(mode = transformPivotMode) {
  if (!currentModel) return new THREE.Vector3();
  currentModel.updateWorldMatrix(true, true);
  if (mode === 'object') return currentModel.getWorldPosition(new THREE.Vector3());

  const box = new THREE.Box3().setFromObject(currentModel, true);
  if (box.isEmpty()) return currentModel.getWorldPosition(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  if (mode === 'bottom') center.y = box.min.y;
  return center;
}

function syncTransformPivotProxy() {
  if (!currentModel) return;
  const position = getTransformPivotWorldPosition();
  transformPivotProxy.position.copy(position);

  const worldSpace = ui.transformSpace?.value === 'world';
  if (worldSpace) {
    transformPivotProxy.quaternion.identity();
  } else {
    currentModel.getWorldQuaternion(transformPivotProxy.quaternion);
  }
  transformPivotProxy.scale.set(1, 1, 1);
  transformPivotProxy.updateMatrixWorld(true);

  // TransformControls internally treats scale as local. Orienting the proxy to
  // world axes makes World scale genuinely different from Local scale.
  const mode = transformControls.getMode();
  transformControls.setSpace(mode === 'scale' ? 'local' : (worldSpace ? 'world' : 'local'));
}

function beginTransformProxyDrag() {
  if (!glbTransformEnabled || !currentModel) return;
  transformPivotProxy.updateMatrixWorld(true);
  currentModel.updateMatrixWorld(true);
  transformDragState = {
    proxyStartWorld: transformPivotProxy.matrixWorld.clone(),
    modelStartWorld: currentModel.matrixWorld.clone(),
    startScale: currentModel.scale.clone(),
  };
}

function applyTransformProxyDelta() {
  if (!transformDragState || !currentModel) return;

  transformPivotProxy.updateMatrixWorld(true);
  const inverseStart = transformDragState.proxyStartWorld.clone().invert();
  const delta = transformPivotProxy.matrixWorld.clone().multiply(inverseStart);
  const desiredWorld = delta.multiply(transformDragState.modelStartWorld);

  const parentInverse = currentModel.parent
    ? currentModel.parent.matrixWorld.clone().invert()
    : new THREE.Matrix4();
  const localMatrix = parentInverse.multiply(desiredWorld);
  localMatrix.decompose(currentModel.position, currentModel.quaternion, currentModel.scale);

  const centerUniformScale = transformControls.getMode() === 'scale' && transformControls.axis === 'XYZ';
  if ((unifiedScaleEnabled || centerUniformScale) && transformControls.getMode() === 'scale') {
    const start = transformDragState.startScale;
    const ratios = [
      currentModel.scale.x / Math.max(Math.abs(start.x), 1e-9),
      currentModel.scale.y / Math.max(Math.abs(start.y), 1e-9),
      currentModel.scale.z / Math.max(Math.abs(start.z), 1e-9),
    ];
    let factor = ratios.reduce((best, value) => Math.abs(value - 1) > Math.abs(best - 1) ? value : best, 1);
    if (!Number.isFinite(factor) || factor <= 0) factor = 1;

    // The stock center handle uses a distance ratio and becomes excessively
    // sensitive near the gizmo origin. Compress that ratio logarithmically.
    if (centerUniformScale) factor = Math.exp(Math.log(factor) * 0.35);
    factor = THREE.MathUtils.clamp(factor, 0.001, 1000);

    const startWorldPosition = new THREE.Vector3();
    const startWorldQuaternion = new THREE.Quaternion();
    const startWorldScale = new THREE.Vector3();
    transformDragState.modelStartWorld.decompose(startWorldPosition, startWorldQuaternion, startWorldScale);
    const pivotWorld = new THREE.Vector3().setFromMatrixPosition(transformDragState.proxyStartWorld);
    const scaledWorldPosition = startWorldPosition.clone().sub(pivotWorld).multiplyScalar(factor).add(pivotWorld);
    const uniformWorld = new THREE.Matrix4().compose(
      scaledWorldPosition,
      startWorldQuaternion,
      startWorldScale.multiplyScalar(factor),
    );
    const uniformLocal = (currentModel.parent ? currentModel.parent.matrixWorld.clone().invert() : new THREE.Matrix4())
      .multiply(uniformWorld);
    uniformLocal.decompose(currentModel.position, currentModel.quaternion, currentModel.scale);
  }

  currentModel.updateMatrixWorld(true);
}

function finishTransformProxyDrag() {
  if (!transformDragState) return;
  applyTransformProxyDelta();
  transformDragState = null;
  syncTransformPivotProxy();
}

function setTransformPivotMode(mode) {
  transformPivotMode = ['center', 'object', 'bottom'].includes(mode) ? mode : 'center';
  if (ui.transformPivot) ui.transformPivot.value = transformPivotMode;
  if (glbTransformEnabled) syncTransformPivotProxy();
}

function setUnifiedScaleEnabled(enabled) {
  unifiedScaleEnabled = Boolean(enabled);
  if (ui.unifiedScaleToggle) {
    ui.unifiedScaleToggle.checked = unifiedScaleEnabled;
    ui.unifiedScaleToggle.closest('.scale-lock-toggle')?.classList.toggle('active', unifiedScaleEnabled);
  }
}

function configureGlbTransformTools() {
  const available = isGlbModel();
  ui.transformPanel.hidden = !available;

  if (!available) {
    setGlbTransformEnabled(false);
    originalGlbTransform = null;
    return;
  }

  originalGlbTransform = {
    position: currentModel.position.clone(),
    quaternion: currentModel.quaternion.clone(),
    scale: currentModel.scale.clone(),
  };

  ui.transformEnabled.checked = false;
  ui.transformSpace.value = 'local';
  ui.transformPivot.value = 'center';
  transformPivotMode = 'center';
  setUnifiedScaleEnabled(false);
  transformControls.setMode('translate');
  transformControls.setSpace('local');
  setTransformModeButtonState('translate');
  setGlbTransformEnabled(false);
  updateTransformFields();
  updateGlbTransformState();
}

function setGlbTransformEnabled(enabled) {
  glbTransformEnabled = Boolean(enabled && isGlbModel());
  ui.transformEnabled.checked = glbTransformEnabled;
  if (!glbTransformEnabled && precisionAlignActive) stopPrecisionAlign(false);

  if (glbTransformEnabled) {
    syncTransformPivotProxy();
    transformControls.attach(transformPivotProxy);
    transformHelper.visible = true;
  } else {
    transformControls.detach();
    transformHelper.visible = false;
    controls.enabled = true;
  }

  ui.transformModeButtons.forEach((button) => { button.disabled = !glbTransformEnabled; });
  ui.transformSpace.disabled = !glbTransformEnabled;
  ui.transformPivot.disabled = !glbTransformEnabled;
  ui.unifiedScaleToggle.disabled = !glbTransformEnabled;
  ui.precisionAlignButton.disabled = !glbTransformEnabled;
  [
    ui.transformPositionX, ui.transformPositionY, ui.transformPositionZ,
    ui.transformRotationX, ui.transformRotationY, ui.transformRotationZ,
    ui.transformScaleX, ui.transformScaleY, ui.transformScaleZ,
    ui.resetTransformButton,
  ].forEach((control) => { control.disabled = !glbTransformEnabled; });
}

function setTransformModeButtonState(mode) {
  for (const button of ui.transformModeButtons) {
    const active = button.dataset.transformMode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function setTransformMode(mode) {
  if (!glbTransformEnabled || !['translate', 'rotate', 'scale'].includes(mode)) return;
  transformControls.setMode(mode);
  syncTransformPivotProxy();
  setTransformModeButtonState(mode);
}

function cleanTransformNumber(value) {
  return Math.abs(value) < 0.0000005 ? 0 : value;
}

function formatTransformNumber(value, digits = 4) {
  const clean = cleanTransformNumber(Number(value) || 0);
  return clean.toFixed(digits).replace(/\.?0+$/, '');
}

function updateTransformFields() {
  if (!isGlbModel()) return;
  ui.transformPositionX.value = formatTransformNumber(currentModel.position.x);
  ui.transformPositionY.value = formatTransformNumber(currentModel.position.y);
  ui.transformPositionZ.value = formatTransformNumber(currentModel.position.z);
  ui.transformRotationX.value = formatTransformNumber(THREE.MathUtils.radToDeg(currentModel.rotation.x), 2);
  ui.transformRotationY.value = formatTransformNumber(THREE.MathUtils.radToDeg(currentModel.rotation.y), 2);
  ui.transformRotationZ.value = formatTransformNumber(THREE.MathUtils.radToDeg(currentModel.rotation.z), 2);
  ui.transformScaleX.value = formatTransformNumber(currentModel.scale.x);
  ui.transformScaleY.value = formatTransformNumber(currentModel.scale.y);
  ui.transformScaleZ.value = formatTransformNumber(currentModel.scale.z);
}

function readFiniteInput(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function hasGlbTransformChanged() {
  if (!isGlbModel() || !originalGlbTransform) return false;
  const epsilon = 1e-7;
  return currentModel.position.distanceToSquared(originalGlbTransform.position) > epsilon
    || 1 - Math.abs(currentModel.quaternion.dot(originalGlbTransform.quaternion)) > epsilon
    || currentModel.scale.distanceToSquared(originalGlbTransform.scale) > epsilon;
}

function updateGlbTransformState() {
  if (!ui.transformState || !ui.saveButton || !ui.saveAsButton) return;
  const changed = hasGlbTransformChanged();
  ui.transformState.textContent = changed ? 'Modified' : 'Original';
  ui.transformState.classList.toggle('modified', changed);
  const disabled = !isGlbModel() || glbExportInProgress;
  ui.saveButton.disabled = disabled;
  ui.saveAsButton.disabled = disabled;
}

function applyTransformFields(changedInput = null) {
  if (!glbTransformEnabled || !isGlbModel()) return;

  currentModel.position.set(
    readFiniteInput(ui.transformPositionX, currentModel.position.x),
    readFiniteInput(ui.transformPositionY, currentModel.position.y),
    readFiniteInput(ui.transformPositionZ, currentModel.position.z),
  );

  currentModel.rotation.set(
    THREE.MathUtils.degToRad(readFiniteInput(ui.transformRotationX, THREE.MathUtils.radToDeg(currentModel.rotation.x))),
    THREE.MathUtils.degToRad(readFiniteInput(ui.transformRotationY, THREE.MathUtils.radToDeg(currentModel.rotation.y))),
    THREE.MathUtils.degToRad(readFiniteInput(ui.transformRotationZ, THREE.MathUtils.radToDeg(currentModel.rotation.z))),
    currentModel.rotation.order,
  );

  const minScale = 0.000001;
  const nextScale = new THREE.Vector3(
    Math.max(minScale, Math.abs(readFiniteInput(ui.transformScaleX, currentModel.scale.x))),
    Math.max(minScale, Math.abs(readFiniteInput(ui.transformScaleY, currentModel.scale.y))),
    Math.max(minScale, Math.abs(readFiniteInput(ui.transformScaleZ, currentModel.scale.z))),
  );
  if (unifiedScaleEnabled && [ui.transformScaleX, ui.transformScaleY, ui.transformScaleZ].includes(changedInput)) {
    const value = changedInput === ui.transformScaleX ? nextScale.x
      : changedInput === ui.transformScaleY ? nextScale.y : nextScale.z;
    nextScale.set(value, value, value);
  }
  currentModel.scale.copy(nextScale);

  currentModel.updateMatrixWorld(true);
  updateTransformFields();
  updateGlbTransformState();
  updateBoundsMeasurement();
  refreshScalePersonAnchor();
}

function resetGlbTransform() {
  if (!isGlbModel() || !originalGlbTransform) return;
  currentModel.position.copy(originalGlbTransform.position);
  currentModel.quaternion.copy(originalGlbTransform.quaternion);
  currentModel.scale.copy(originalGlbTransform.scale);
  currentModel.updateMatrixWorld(true);
  updateTransformFields();
  updateGlbTransformState();
  updateBoundsMeasurement();
  refreshScalePersonAnchor();
}

function getPrecisionViewportSize() {
  return {
    width: Math.max(1, ui.viewport.clientWidth),
    height: Math.max(1, ui.viewport.clientHeight),
  };
}

function projectModelCenterToViewport() {
  const { width, height } = getPrecisionViewportSize();
  if (!currentModel) return { x: width * 0.5, y: height * 0.5 };

  const box = new THREE.Box3().setFromObject(currentModel, true);
  if (box.isEmpty()) return { x: width * 0.5, y: height * 0.5 };

  const center = box.getCenter(new THREE.Vector3()).project(camera);
  return {
    x: (center.x * 0.5 + 0.5) * width,
    y: (-center.y * 0.5 + 0.5) * height,
  };
}

function clampGuidePoint(point, width, height) {
  const margin = 12;
  point.x = THREE.MathUtils.clamp(point.x, margin, Math.max(margin, width - margin));
  point.y = THREE.MathUtils.clamp(point.y, margin, Math.max(margin, height - margin));
}

function resetPrecisionAlignGuides() {
  const { width, height } = getPrecisionViewportSize();
  ui.precisionAlignSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const center = projectModelCenterToViewport();
  const length = THREE.MathUtils.clamp(Math.min(width, height) * 0.34, 110, 360);

  precisionGuides.x.p1 = { x: center.x - length * 0.5, y: center.y };
  precisionGuides.x.p2 = { x: center.x + length * 0.5, y: center.y };
  precisionGuides.y.p1 = { x: center.x, y: center.y - length * 0.5 };
  precisionGuides.y.p2 = { x: center.x, y: center.y + length * 0.5 };

  clampGuidePoint(precisionGuides.x.p1, width, height);
  clampGuidePoint(precisionGuides.x.p2, width, height);
  clampGuidePoint(precisionGuides.y.p1, width, height);
  clampGuidePoint(precisionGuides.y.p2, width, height);
  precisionSurfaceSample = samplePrecisionSurface();
  renderPrecisionAlignGuides(false, false);
}

function setSvgLine(line, p1, p2) {
  line.setAttribute('x1', p1.x);
  line.setAttribute('y1', p1.y);
  line.setAttribute('x2', p2.x);
  line.setAttribute('y2', p2.y);
}

function setSvgPoint(circle, point) {
  circle.setAttribute('cx', point.x);
  circle.setAttribute('cy', point.y);
}

function guideLength(guide) {
  return Math.hypot(guide.p2.x - guide.p1.x, guide.p2.y - guide.p1.y);
}

function precisionPointToNdc(point) {
  const { width, height } = getPrecisionViewportSize();
  return new THREE.Vector2(
    (point.x / width) * 2 - 1,
    -(point.y / height) * 2 + 1,
  );
}

function raycastPrecisionPoint(point) {
  if (!currentModel) return null;
  precisionRaycaster.setFromCamera(precisionPointToNdc(point), camera);
  const hit = precisionRaycaster
    .intersectObject(currentModel, true)
    .find((entry) => !entry.object.userData?.viewerHelper && entry.object.visible);
  return hit ? hit.point.clone() : null;
}

function samplePrecisionSurface() {
  if (!currentModel) return { valid: false, hitCount: 0 };

  currentModel.updateWorldMatrix(true, true);

  const x1 = raycastPrecisionPoint(precisionGuides.x.p1);
  const x2 = raycastPrecisionPoint(precisionGuides.x.p2);
  const y1 = raycastPrecisionPoint(precisionGuides.y.p1);
  const y2 = raycastPrecisionPoint(precisionGuides.y.p2);
  const hits = { x1, x2, y1, y2 };
  const hitCount = Object.values(hits).filter(Boolean).length;

  if (hitCount !== 4) return { valid: false, hitCount, hits };

  const xVector = x2.clone().sub(x1);
  const yVector = y2.clone().sub(y1);
  const xLength = xVector.length();
  const yLength = yVector.length();
  if (xLength < 1e-8 || yLength < 1e-8) {
    return { valid: false, hitCount, hits, reason: 'Guide span is too short.' };
  }

  const xAxis = xVector.clone().normalize();
  const yRaw = yVector.clone().normalize();
  const rawDot = THREE.MathUtils.clamp(xAxis.dot(yRaw), -1, 1);
  const rawAngle = THREE.MathUtils.radToDeg(Math.acos(rawDot));
  const axisError = Math.abs(90 - rawAngle);

  const yAxis = yRaw.clone().addScaledVector(xAxis, -rawDot);
  if (yAxis.lengthSq() < 1e-10) {
    return { valid: false, hitCount, hits, xLength, yLength, axisError, reason: 'X and Y guides are parallel.' };
  }
  yAxis.normalize();

  const zAxis = xAxis.clone().cross(yAxis);
  if (zAxis.lengthSq() < 1e-10) {
    return { valid: false, hitCount, hits, xLength, yLength, axisError, reason: 'Could not build a 3D axis basis.' };
  }
  zAxis.normalize();
  yAxis.copy(zAxis).cross(xAxis).normalize();

  const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  const measuredOrientation = new THREE.Quaternion().setFromRotationMatrix(basis).normalize();
  const delta = measuredOrientation.clone().invert();
  const rotationDelta = THREE.MathUtils.radToDeg(
    2 * Math.acos(THREE.MathUtils.clamp(Math.abs(delta.w), -1, 1)),
  );

  return {
    valid: true,
    hitCount,
    hits,
    xLength,
    yLength,
    axisError,
    rotationDelta,
    delta,
  };
}

function applyPrecisionHitClasses(sample) {
  const hits = sample?.hits || {};
  [
    [ui.alignX1, hits.x1],
    [ui.alignX2, hits.x2],
    [ui.alignY1, hits.y1],
    [ui.alignY2, hits.y2],
  ].forEach(([handle, hit]) => {
    handle.classList.toggle('miss', !hit);
    handle.classList.toggle('snapped', Boolean(hit));
  });
}

function updatePrecisionSurfaceReadouts(sample, dragging = false) {
  if (dragging) {
    ui.alignHitStatus.textContent = 'Release to sample the model surface';
    ui.alignConfirmButton.disabled = true;
    return;
  }

  const hitCount = sample?.hitCount || 0;
  applyPrecisionHitClasses(sample);

  if (!sample || !sample.valid) {
    ui.alignXAngle.textContent = sample?.xLength ? formatMeters(sample.xLength * getUnityMetersPerUnit()) : '—';
    ui.alignYAngle.textContent = sample?.yLength ? formatMeters(sample.yLength * getUnityMetersPerUnit()) : '—';
    ui.alignCorrection.textContent = '—';
    ui.alignAxisError.textContent = Number.isFinite(sample?.axisError) ? `${sample.axisError.toFixed(2)}°` : '—';
    ui.alignAxisError.classList.toggle('warning', Number.isFinite(sample?.axisError) && sample.axisError > 3);
    ui.alignHitStatus.textContent = sample?.reason || `${hitCount}/4 surface points · move every endpoint onto the model`;
    ui.alignConfirmButton.disabled = true;
    return;
  }

  const metersPerUnit = getUnityMetersPerUnit();
  ui.alignXAngle.textContent = formatMeters(sample.xLength * metersPerUnit);
  ui.alignYAngle.textContent = formatMeters(sample.yLength * metersPerUnit);
  ui.alignCorrection.textContent = `${sample.rotationDelta.toFixed(2)}°`;
  ui.alignAxisError.textContent = `${sample.axisError.toFixed(2)}°`;
  ui.alignAxisError.classList.toggle('warning', sample.axisError > 3);
  ui.alignHitStatus.textContent = `4/4 surface points · X+/Y+ define positive world axes`;
  ui.alignConfirmButton.disabled = false;
}

function renderPrecisionAlignGuides(sampleSurface = false, dragging = false) {
  setSvgLine(ui.alignXLine, precisionGuides.x.p1, precisionGuides.x.p2);
  setSvgLine(ui.alignYLine, precisionGuides.y.p1, precisionGuides.y.p2);
  setSvgPoint(ui.alignX1, precisionGuides.x.p1);
  setSvgPoint(ui.alignX2, precisionGuides.x.p2);
  setSvgPoint(ui.alignY1, precisionGuides.y.p1);
  setSvgPoint(ui.alignY2, precisionGuides.y.p2);

  ui.alignXLabel.setAttribute('x', precisionGuides.x.p2.x + 10);
  ui.alignXLabel.setAttribute('y', precisionGuides.x.p2.y - 8);
  ui.alignYLabel.setAttribute('x', precisionGuides.y.p2.x + 10);
  ui.alignYLabel.setAttribute('y', precisionGuides.y.p2.y - 8);

  if (sampleSurface) precisionSurfaceSample = samplePrecisionSurface();
  updatePrecisionSurfaceReadouts(precisionSurfaceSample, dragging);
}

function startPrecisionAlign() {
  if (!glbTransformEnabled || !isGlbModel()) return;
  precisionAlignActive = true;
  precisionSurfaceSample = null;
  precisionAlignAutoRotateWasEnabled = controls.autoRotate;
  controls.autoRotate = false;
  transformControls.detach();
  transformHelper.visible = false;
  controls.enabled = false;
  ui.precisionAlignOverlay.hidden = false;
  resetPrecisionAlignGuides();
  setStatus('Precision Align: place all four X/Y endpoints on the model surface; labeled ends are +X/+Y');
}

function stopPrecisionAlign(restoreTransform = true) {
  precisionAlignActive = false;
  precisionAlignDrag = null;
  precisionSurfaceSample = null;
  ui.precisionAlignOverlay.hidden = true;
  controls.enabled = true;
  controls.autoRotate = precisionAlignAutoRotateWasEnabled && ui.autorotateToggle.checked;
  precisionAlignAutoRotateWasEnabled = false;
  if (restoreTransform && glbTransformEnabled && currentModel) {
    transformControls.attach(currentModel);
    transformHelper.visible = true;
  }
}

function pointerToPrecisionCoordinates(event) {
  const rect = ui.precisionAlignSvg.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function beginPrecisionDrag(event, guideName, pointName) {
  if (!precisionAlignActive) return;
  event.preventDefault();
  event.stopPropagation();
  const point = pointerToPrecisionCoordinates(event);
  const guide = precisionGuides[guideName];
  precisionAlignDrag = {
    pointerId: event.pointerId,
    guideName,
    pointName,
    startPointer: point,
    startP1: { ...guide.p1 },
    startP2: { ...guide.p2 },
  };
}

function updatePrecisionDrag(event) {
  if (!precisionAlignDrag || event.pointerId !== precisionAlignDrag.pointerId) return;
  const { width, height } = getPrecisionViewportSize();
  const pointer = pointerToPrecisionCoordinates(event);
  const dxRaw = pointer.x - precisionAlignDrag.startPointer.x;
  const dyRaw = pointer.y - precisionAlignDrag.startPointer.y;
  const guide = precisionGuides[precisionAlignDrag.guideName];

  if (precisionAlignDrag.pointName === 'line') {
    const margin = 12;
    const minX = Math.min(precisionAlignDrag.startP1.x, precisionAlignDrag.startP2.x);
    const maxX = Math.max(precisionAlignDrag.startP1.x, precisionAlignDrag.startP2.x);
    const minY = Math.min(precisionAlignDrag.startP1.y, precisionAlignDrag.startP2.y);
    const maxY = Math.max(precisionAlignDrag.startP1.y, precisionAlignDrag.startP2.y);
    const dx = THREE.MathUtils.clamp(dxRaw, margin - minX, width - margin - maxX);
    const dy = THREE.MathUtils.clamp(dyRaw, margin - minY, height - margin - maxY);
    guide.p1 = { x: precisionAlignDrag.startP1.x + dx, y: precisionAlignDrag.startP1.y + dy };
    guide.p2 = { x: precisionAlignDrag.startP2.x + dx, y: precisionAlignDrag.startP2.y + dy };
  } else {
    guide[precisionAlignDrag.pointName] = { x: pointer.x, y: pointer.y };
    clampGuidePoint(guide[precisionAlignDrag.pointName], width, height);
  }

  precisionSurfaceSample = null;
  renderPrecisionAlignGuides(false, true);
}

function endPrecisionDrag(event) {
  if (!precisionAlignDrag || event.pointerId !== precisionAlignDrag.pointerId) return;
  precisionAlignDrag = null;
  precisionSurfaceSample = samplePrecisionSurface();
  renderPrecisionAlignGuides(false, false);
}

function applyPrecisionAlignment() {
  if (!precisionAlignActive || !currentModel) return;
  const sample = precisionSurfaceSample?.valid ? precisionSurfaceSample : samplePrecisionSurface();
  if (!sample.valid) {
    precisionSurfaceSample = sample;
    renderPrecisionAlignGuides(false, false);
    return;
  }

  currentModel.updateWorldMatrix(true, true);
  const beforeCenter = new THREE.Box3().setFromObject(currentModel, true).getCenter(new THREE.Vector3());

  currentModel.quaternion.premultiply(sample.delta);
  currentModel.updateMatrixWorld(true);

  const afterCenter = new THREE.Box3().setFromObject(currentModel, true).getCenter(new THREE.Vector3());
  currentModel.position.add(beforeCenter.sub(afterCenter));
  currentModel.updateMatrixWorld(true);

  updateTransformFields();
  updateGlbTransformState();
  updateBoundsMeasurement();
  updateStageFromModel();
  refreshScalePersonAnchor();
  stopPrecisionAlign(true);
  setStatus(`3D axis alignment applied · rotation Δ ${sample.rotationDelta.toFixed(2)}° · axis error ${sample.axisError.toFixed(2)}°`);
}

function collectGlbExportState() {
  const helpers = [];
  const materials = [];
  const userData = [];

  currentModel.traverse((node) => {
    if (node.userData?.viewerHelper && node.parent) {
      helpers.push({ node, parent: node.parent });
      return;
    }

    if (node.isMesh) {
      materials.push({ node, material: node.material });
      if (node.userData?.viewerOriginalMaterial) node.material = node.userData.viewerOriginalMaterial;
    }

    if (node.userData) {
      const viewerOriginalMaterial = node.userData.viewerOriginalMaterial;
      const viewerMaterialVariants = node.userData.viewerMaterialVariants;
      const viewerHelper = node.userData.viewerHelper;
      if (viewerOriginalMaterial !== undefined || viewerMaterialVariants !== undefined || viewerHelper !== undefined) {
        userData.push({ node, viewerOriginalMaterial, viewerMaterialVariants, viewerHelper });
        delete node.userData.viewerOriginalMaterial;
        delete node.userData.viewerMaterialVariants;
        delete node.userData.viewerHelper;
      }
    }
  });

  for (const entry of helpers) entry.parent.remove(entry.node);
  return { helpers, materials, userData };
}

function restoreGlbExportState(state) {
  for (const entry of state.userData) {
    if (entry.viewerOriginalMaterial !== undefined) entry.node.userData.viewerOriginalMaterial = entry.viewerOriginalMaterial;
    if (entry.viewerMaterialVariants !== undefined) entry.node.userData.viewerMaterialVariants = entry.viewerMaterialVariants;
    if (entry.viewerHelper !== undefined) entry.node.userData.viewerHelper = entry.viewerHelper;
  }
  for (const entry of state.materials) entry.node.material = entry.material;
  for (const entry of state.helpers) entry.parent.add(entry.node);
  updateWireOverlays();
}

async function createCurrentGlbBuffer() {
  let exportState = null;
  try {
    exportState = collectGlbExportState();
    currentModel.updateMatrixWorld(true);

    const exporter = new GLTFExporter();
    const result = await exporter.parseAsync(currentModel, {
      binary: true,
      trs: true,
      onlyVisible: false,
      animations: currentAnimations,
    });
    if (!(result instanceof ArrayBuffer)) throw new Error('GLB exporter did not return binary data.');
    return result;
  } finally {
    if (exportState) restoreGlbExportState(exportState);
  }
}

function markCurrentGlbSaved(fileName = null) {
  if (!isGlbModel()) return;
  originalGlbTransform = {
    position: currentModel.position.clone(),
    quaternion: currentModel.quaternion.clone(),
    scale: currentModel.scale.clone(),
  };
  if (fileName) {
    currentFileName = fileName;
    ui.modelName.textContent = fileName;
  }
  updateGlbTransformState();
}

async function writeBlobToHandle(handle, blob) {
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function requestGlbSaveHandle(suggestedName) {
  if (typeof window.showSaveFilePicker !== 'function') return { handle: null, fallback: true };
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [{
        description: 'Binary glTF',
        accept: { 'model/gltf-binary': ['.glb'] },
      }],
    });
    return { handle, fallback: false };
  } catch (error) {
    if (error?.name === 'AbortError') return { cancelled: true };
    console.warn('Save picker failed, falling back to browser download.', error);
    return { handle: null, fallback: true };
  }
}

function bytesToBase64(bytes) {
  let binary = '';
  const block = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += block) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + block)));
  }
  return btoa(binary);
}

async function overwriteNativeActiveSource(buffer) {
  if (!window.zero?.invoke) throw new Error('Native save bridge is unavailable.');
  await window.zero.invoke('app.beginActiveSourceSave', {});
  try {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 256 * 1024;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
      await window.zero.invoke('app.writeActiveSourceSaveChunk', {
        offset,
        data: bytesToBase64(chunk),
      });
    }
    return await window.zero.invoke('app.finishActiveSourceSave', {});
  } catch (error) {
    try {
      await window.zero.invoke('app.cancelActiveSourceSave', {});
    } catch {
      // Best effort cleanup.
    }
    throw error;
  }
}

async function runGlbSave(statusText, operation) {
  if (!isGlbModel() || glbExportInProgress) return false;
  glbExportInProgress = true;
  updateGlbTransformState();
  setStatus(statusText);
  try {
    return await operation();
  } catch (error) {
    console.error('GLB save failed', error);
    setStatus(`GLB save failed: ${error?.message || error}`, true);
    return false;
  } finally {
    glbExportInProgress = false;
    updateGlbTransformState();
    updateBoundsMeasurement();
  }
}

async function saveCurrentGlb() {
  if (!isGlbModel() || glbExportInProgress) return;

  if (!currentGlbSaveHandle && !currentGlbNativeSource) {
    await saveAsCurrentGlb();
    return;
  }

  await runGlbSave('Saving GLB…', async () => {
    const buffer = await createCurrentGlbBuffer();
    const blob = new Blob([buffer], { type: 'model/gltf-binary' });

    if (currentGlbSaveHandle) {
      await writeBlobToHandle(currentGlbSaveHandle, blob);
      markCurrentGlbSaved(currentGlbSaveHandle.name || currentFileName);
      setStatus(`${currentGlbSaveHandle.name || currentFileName} saved`);
      return true;
    }

    const result = await overwriteNativeActiveSource(buffer);
    markCurrentGlbSaved();
    setStatus(`${result?.name || currentFileName} saved`);
    return true;
  });
}

async function saveAsCurrentGlb() {
  if (!isGlbModel() || glbExportInProgress) return;

  const base = currentFileName.replace(/\.glb$/i, '') || 'model';
  const suggestedName = `${base}-edited.glb`;

  // Request the handle before exporting so the browser still has the user's
  // transient activation from the navbar click / Ctrl+Shift+S shortcut.
  const target = await requestGlbSaveHandle(suggestedName);
  if (target?.cancelled) {
    setStatus('Save As cancelled');
    return;
  }

  await runGlbSave('Saving GLB as…', async () => {
    const buffer = await createCurrentGlbBuffer();
    const blob = new Blob([buffer], { type: 'model/gltf-binary' });

    if (target?.handle) {
      await writeBlobToHandle(target.handle, blob);
      currentGlbSaveHandle = target.handle;
      currentGlbNativeSource = false;
      if (window.zero?.invoke) {
        try {
          await window.zero.invoke('app.clearActiveSource', {});
        } catch (error) {
          console.warn('Could not clear previous native save target.', error);
        }
      }
      const savedName = target.handle.name || suggestedName;
      markCurrentGlbSaved(savedName);
      setStatus(`${savedName} saved`);
      return true;
    }

    downloadBlob(blob, suggestedName);
    setStatus(`${suggestedName} exported`);
    return true;
  });
}

function getUnityMetersPerUnit() {
  const extension = getExtension(currentFileName);

  // Unity world scale is meter-based. FBX stores UnitScaleFactor as
  // centimeters per file unit (1 = cm, 100 = m), so divide by 100.
  if (extension === 'fbx') {
    const fbxUnitScale = Number(currentModel?.userData?.unitScaleFactor);
    if (Number.isFinite(fbxUnitScale) && fbxUnitScale > 0) return fbxUnitScale / 100;
    return 0.01;
  }

  // Match Unity's conventional import scale for legacy 3DS assets.
  if (extension === '3ds') return 0.1;

  // glTF/GLB are meter-based. Unitless formats are treated as one meter per
  // file unit, which matches Unity's world-unit convention.
  return 1;
}

function formatMeters(value) {
  if (!Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  const maximumFractionDigits = magnitude >= 100 ? 2 : magnitude >= 1 ? 3 : magnitude >= 0.01 ? 4 : 6;
  return `${value.toLocaleString('en-US', { maximumFractionDigits })} m`;
}

function updateBoundsMeasurement() {
  const target = isolationTarget || currentModel;
  if (!target) {
    boundsBox.makeEmpty();
    boundsHelper.visible = false;
    return;
  }

  target.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(target, true);
  if (box.isEmpty()) {
    boundsBox.makeEmpty();
    boundsHelper.visible = false;
    ui.boundsTarget.textContent = 'Empty';
    ui.dimensionX.textContent = '—';
    ui.dimensionY.textContent = '—';
    ui.dimensionZ.textContent = '—';
    return;
  }

  const size = box.getSize(new THREE.Vector3());
  const metersPerUnit = getUnityMetersPerUnit();

  ui.boundsTarget.textContent = isolationTarget
    ? (isolationTarget.name || isolationTarget.type || 'Isolated object')
    : 'Whole model';
  ui.dimensionX.textContent = formatMeters(size.x * metersPerUnit);
  ui.dimensionY.textContent = formatMeters(size.y * metersPerUnit);
  ui.dimensionZ.textContent = formatMeters(size.z * metersPerUnit);

  const extension = getExtension(currentFileName);
  if (extension === 'fbx') {
    const fbxUnitScale = Number(currentModel?.userData?.unitScaleFactor);
    ui.boundsScale.textContent = Number.isFinite(fbxUnitScale) && fbxUnitScale > 0
      ? `FBX → Unity: 1 file unit = ${formatMeters(metersPerUnit)}`
      : 'FBX → Unity fallback: 1 file unit = 0.01 m';
  } else if (extension === '3ds') {
    ui.boundsScale.textContent = '3DS → Unity: 1 file unit = 0.1 m';
  } else {
    ui.boundsScale.textContent = 'Unity scale: 1 unit = 1 m';
  }

  boundsBox.copy(box);
  boundsHelper.visible = boundsVisible;
}

function updateStageFromModel() {
  if (!currentModel) return;
  const box = new THREE.Box3().setFromObject(currentModel);
  if (box.isEmpty()) return;
  lastModelBounds = box.clone();
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.5, 0.001);
  const floorY = box.min.y - radius * 0.003;

  grid.position.set(center.x, floorY, center.z);
  grid.scale.setScalar(Math.max(radius, 0.001));
  axes.position.set(box.min.x, floorY + radius * 0.002, box.min.z);
  axes.scale.setScalar(Math.max(radius * 0.7, 0.001));

  ground.position.set(center.x, floorY - radius * 0.0015, center.z);
  ground.scale.set(radius * 7, radius * 7, 1);

  keyLight.position.set(center.x + radius * 2.5, center.y + radius * 3.5, center.z + radius * 2.2);
  keyLight.target.position.copy(center);
  fillLight.position.set(center.x - radius * 2.5, center.y + radius * 1.8, center.z - radius * 1.8);

  const shadowRange = radius * 3;
  keyLight.shadow.camera.left = -shadowRange;
  keyLight.shadow.camera.right = shadowRange;
  keyLight.shadow.camera.top = shadowRange;
  keyLight.shadow.camera.bottom = -shadowRange;
  keyLight.shadow.camera.near = Math.max(radius * 0.02, 0.01);
  keyLight.shadow.camera.far = Math.max(radius * 9, 10);
  keyLight.shadow.camera.updateProjectionMatrix();
}

function fitObject(object, preserveDirection = true) {
  if (!object) return;
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.5, 0.001);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = (radius / Math.sin(fov * 0.5)) * 1.18;

  let direction;
  if (preserveDirection) {
    direction = camera.position.clone().sub(controls.target).normalize();
    if (!Number.isFinite(direction.x) || direction.lengthSq() < 0.1) direction = new THREE.Vector3(1, 0.7, 1.15).normalize();
  } else {
    direction = new THREE.Vector3(1, 0.72, 1.2).normalize();
  }

  camera.position.copy(center).addScaledVector(direction, distance);
  camera.near = Math.max(radius / 1500, 0.001);
  camera.far = Math.max(radius * 150, 1000);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.minDistance = Math.max(radius * 0.015, 0.0001);
  controls.maxDistance = Math.max(radius * 60, 100);
  controls.update();
}

function resetCamera() {
  if (currentModel) fitObject(currentModel, false);
  else {
    camera.position.set(3.2, 2.3, 4.2);
    controls.target.set(0, 0, 0);
    controls.update();
  }
}

function toArray(value) {
  return Array.isArray(value) ? value : [value];
}

function fromArrayLikeOriginal(original, values) {
  return Array.isArray(original) ? values : values[0];
}

function makeMaterialVariant(source, mode) {
  if (mode === 'textured') {
    return new THREE.MeshBasicMaterial({
      color: source?.color?.clone?.() || new THREE.Color(0xffffff),
      map: source?.map || null,
      alphaMap: source?.alphaMap || null,
      aoMap: source?.aoMap || null,
      vertexColors: Boolean(source?.vertexColors),
      transparent: Boolean(source?.transparent),
      opacity: source?.opacity ?? 1,
      alphaTest: source?.alphaTest ?? 0,
      side: source?.side ?? THREE.FrontSide,
      depthWrite: source?.depthWrite ?? true,
    });
  }

  if (mode === 'clay') {
    return new THREE.MeshStandardMaterial({
      color: clayColor,
      roughness: 0.78,
      metalness: 0.02,
      side: source?.side ?? THREE.FrontSide,
      vertexColors: false,
    });
  }

  return new THREE.MeshBasicMaterial({
    color: 0x151b22,
    wireframe: true,
    transparent: false,
    side: THREE.DoubleSide,
  });
}

function materialForMode(mesh, mode) {
  const original = mesh.userData.viewerOriginalMaterial || mesh.material;
  if (mode === 'textured-lighting') return original;
  const cache = mesh.userData.viewerMaterialVariants || (mesh.userData.viewerMaterialVariants = {});
  if (!cache[mode]) {
    cache[mode] = fromArrayLikeOriginal(original, toArray(original).map((material) => makeMaterialVariant(material, mode)));
  }
  return cache[mode];
}

function applyRenderMode(mode) {
  currentMode = mode;
  ui.modeSelect.value = mode;
  ui.clayColorControl.hidden = mode !== 'clay';
  if (!currentModel) return;
  currentModel.traverse((child) => {
    if (!child.isMesh || child.userData.viewerHelper) return;
    child.material = materialForMode(child, mode);
  });
  updateWireOverlays();
  ui.viewportBadge.textContent = modeLabels[mode] || mode;
}

function applyClayColor(value) {
  clayColor = value;
  currentModel?.traverse((child) => {
    if (!child.isMesh || child.userData.viewerHelper) return;
    const clayVariant = child.userData.viewerMaterialVariants?.clay;
    if (!clayVariant) return;
    toArray(clayVariant).forEach((material) => material.color?.set(clayColor));
  });
}

function applyLighting() {
  hemisphere.visible = lightingEnabled;
  keyLight.visible = lightingEnabled;
  fillLight.visible = lightingEnabled;
  scene.environment = lightingEnabled ? environmentTexture : null;
  applyShadows();
}

function applyShadows() {
  renderer.shadowMap.enabled = shadowsEnabled;
  keyLight.castShadow = shadowsEnabled && lightingEnabled;
  ground.visible = shadowsEnabled && lightingEnabled && Boolean(currentModel);
  currentModel?.traverse((child) => {
    if (child.isMesh && !child.userData.viewerHelper) {
      child.castShadow = shadowsEnabled;
      child.receiveShadow = shadowsEnabled;
    }
  });
}

function updateWireOverlays() {
  currentModel?.traverse((child) => {
    if (child.userData.viewerHelper && child.name === '__viewer_wire_overlay__') {
      child.visible = wireOverlayEnabled && currentMode !== 'wireframe';
    }
  });
}

function configureAnimations() {
  ui.animationSelect.replaceChildren();
  ui.animationPanel.hidden = currentAnimations.length === 0;
  if (!currentModel || !currentAnimations.length) return;

  mixer = new THREE.AnimationMixer(currentModel);
  currentAnimations.forEach((clip, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = clip.name || `Animation ${index + 1}`;
    ui.animationSelect.append(option);
  });
  playAnimation(0);
}

function playAnimation(index) {
  if (!mixer || !currentAnimations[index]) return;
  activeAction?.stop();
  activeAction = mixer.clipAction(currentAnimations[index]);
  activeAction.reset().play();
  animationPlaying = true;
  ui.playPauseButton.textContent = 'Pause';
}

function toggleAnimationPlayback() {
  if (!activeAction) return;
  animationPlaying = !animationPlaying;
  activeAction.paused = !animationPlaying;
  ui.playPauseButton.textContent = animationPlaying ? 'Pause' : 'Play';
}

function renderObjectTree() {
  treeRows = [];
  ui.objectTree.replaceChildren();
  if (!currentModel) return;

  let shown = 0;
  const limit = 1500;
  const fragment = document.createDocumentFragment();

  const addNode = (node, depth) => {
    if (node.userData.viewerHelper || shown >= limit) return;
    shown += 1;
    const row = document.createElement('div');
    row.className = 'tree-row';
    row.dataset.search = `${node.name || ''} ${node.type || ''}`.toLowerCase();
    row.dataset.uuid = node.uuid;

    const eye = document.createElement('button');
    eye.className = `tree-eye${node.visible ? '' : ' off'}`;
    eye.title = node.visible ? 'Hide object' : 'Show object';
    eye.textContent = node.visible ? '●' : '○';
    eye.addEventListener('click', (event) => {
      event.stopPropagation();
      if (isolationTarget) clearIsolation();
      node.visible = !node.visible;
      renderObjectTree();
    });

    const name = document.createElement('button');
    name.className = 'tree-name';
    name.style.paddingLeft = `${Math.min(depth, 14) * 11 + 4}px`;
    name.title = node.name || node.type;
    name.innerHTML = `${escapeHtml(node.name || node.type || 'Object')}<span class="tree-type">${escapeHtml(node.type || '')}</span>`;
    name.addEventListener('click', () => fitObject(node, true));

    const isolate = document.createElement('button');
    isolate.className = 'tree-isolate';
    isolate.title = isolationTarget === node ? 'Exit isolation' : 'Isolate object';
    isolate.textContent = isolationTarget === node ? 'ALL' : 'ISO';
    isolate.addEventListener('click', (event) => {
      event.stopPropagation();
      isolateObject(node);
    });

    if (isolationTarget === node) row.classList.add('is-isolated');
    row.append(eye, name, isolate);
    fragment.append(row);
    treeRows.push(row);
    node.children.forEach((child) => addNode(child, depth + 1));
  };

  addNode(currentModel, 0);
  ui.objectTree.append(fragment);
  if (shown >= limit) {
    const note = document.createElement('div');
    note.className = 'tree-empty';
    note.textContent = `Object list limited to ${limit.toLocaleString()} entries for performance.`;
    ui.objectTree.append(note);
  }
  filterTree(ui.treeSearch.value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function filterTree(query) {
  const text = String(query || '').trim().toLowerCase();
  for (const row of treeRows) row.classList.toggle('filtered-out', Boolean(text) && !row.dataset.search.includes(text));
}

function isolateObject(node) {
  if (!currentModel) return;
  if (isolationTarget === node) {
    clearIsolation();
    return;
  }
  if (isolationTarget) clearIsolation(false);

  visibilitySnapshot = new Map();
  currentModel.traverse((item) => {
    visibilitySnapshot.set(item, item.visible);
    item.visible = false;
  });

  node.traverse((item) => { item.visible = true; });
  let parent = node.parent;
  while (parent) {
    parent.visible = true;
    if (parent === currentModel) break;
    parent = parent.parent;
  }
  isolationTarget = node;
  ui.clearIsolationButton.hidden = false;
  updateWireOverlays();
  updateBoundsMeasurement();
  renderObjectTree();
  fitObject(node, true);
}

function clearIsolation(rerender = true) {
  if (visibilitySnapshot) {
    for (const [object, visible] of visibilitySnapshot) object.visible = visible;
  }
  visibilitySnapshot = null;
  isolationTarget = null;
  ui.clearIsolationButton.hidden = true;
  updateWireOverlays();
  if (currentModel) updateBoundsMeasurement();
  if (rerender && currentModel) renderObjectTree();
}

function takeScreenshot() {
  renderer.render(scene, camera);
  renderer.domElement.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const base = currentFileName ? currentFileName.replace(/\.[^.]+$/, '') : '3d-view';
    link.href = url;
    link.download = `${base}-view.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

function handleDoubleClick(event) {
  if (!currentModel) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(currentModel, true).find((entry) => !entry.object.userData.viewerHelper);
  if (hit) fitObject(hit.object, true);
}

function onResize() {
  const width = Math.max(1, ui.viewport.clientWidth);
  const height = Math.max(1, ui.viewport.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  positionScalePersonReference();
  if (precisionAlignActive) resetPrecisionAlignGuides();
}

controls.addEventListener('change', positionScalePersonReference);
new ResizeObserver(onResize).observe(ui.viewport);
onResize();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (mixer && animationPlaying) mixer.update(delta);
  controls.update();
  renderer.render(scene, camera);
}
animate();

ui.openButton.addEventListener('click', openWithFileSystemPicker);
ui.emptyOpenButton.addEventListener('click', openWithFileSystemPicker);
ui.fileInput.addEventListener('change', async () => {
  await loadFiles(ui.fileInput.files);
  ui.fileInput.value = '';
});
ui.fitButton.addEventListener('click', () => currentModel && fitObject(isolationTarget || currentModel, true));
ui.resetButton.addEventListener('click', resetCamera);
ui.screenshotButton.addEventListener('click', takeScreenshot);
ui.modeSelect.addEventListener('change', () => applyRenderMode(ui.modeSelect.value));
ui.clayColor.addEventListener('input', () => applyClayColor(ui.clayColor.value));
ui.lightingToggle.addEventListener('change', () => {
  lightingEnabled = ui.lightingToggle.checked;
  applyLighting();
});
ui.shadowsToggle.addEventListener('change', () => {
  shadowsEnabled = ui.shadowsToggle.checked;
  applyShadows();
});
ui.wireToggle.addEventListener('change', () => {
  wireOverlayEnabled = ui.wireToggle.checked;
  updateWireOverlays();
});
ui.gridToggle.addEventListener('change', () => { grid.visible = ui.gridToggle.checked; });
ui.axesToggle.addEventListener('change', () => { axes.visible = ui.axesToggle.checked; });
ui.boundsToggleButton.addEventListener('click', () => {
  boundsVisible = !boundsVisible;
  ui.boundsToggleButton.textContent = boundsVisible ? 'Hide box' : 'Show box';
  ui.boundsToggleButton.setAttribute('aria-pressed', String(boundsVisible));
  updateBoundsMeasurement();
});
ui.scalePersonToggleButton.addEventListener('click', () => setScalePersonVisible(!scalePersonVisible));
ui.transformEnabled.addEventListener('change', () => setGlbTransformEnabled(ui.transformEnabled.checked));
ui.transformModeButtons.forEach((button) => {
  button.addEventListener('click', () => setTransformMode(button.dataset.transformMode));
});
ui.transformSpace.addEventListener('change', () => {
  if (!glbTransformEnabled) return;
  syncTransformPivotProxy();
});
ui.transformPivot.addEventListener('change', () => setTransformPivotMode(ui.transformPivot.value));
ui.unifiedScaleToggle.addEventListener('change', () => setUnifiedScaleEnabled(ui.unifiedScaleToggle.checked));
[
  ui.transformPositionX, ui.transformPositionY, ui.transformPositionZ,
  ui.transformRotationX, ui.transformRotationY, ui.transformRotationZ,
  ui.transformScaleX, ui.transformScaleY, ui.transformScaleZ,
].forEach((input) => {
  input.addEventListener('change', () => applyTransformFields(input));
});
ui.resetTransformButton.addEventListener('click', resetGlbTransform);
ui.saveButton.addEventListener('click', saveCurrentGlb);
ui.saveAsButton.addEventListener('click', saveAsCurrentGlb);
ui.precisionAlignButton.addEventListener('click', startPrecisionAlign);
ui.alignResetButton.addEventListener('click', resetPrecisionAlignGuides);
ui.alignCancelButton.addEventListener('click', () => stopPrecisionAlign(true));
ui.alignConfirmButton.addEventListener('click', applyPrecisionAlignment);

[
  [ui.alignX1, 'x', 'p1'],
  [ui.alignX2, 'x', 'p2'],
  [ui.alignY1, 'y', 'p1'],
  [ui.alignY2, 'y', 'p2'],
  [ui.alignXLine, 'x', 'line'],
  [ui.alignYLine, 'y', 'line'],
].forEach(([element, guideName, pointName]) => {
  element.addEventListener('pointerdown', (event) => beginPrecisionDrag(event, guideName, pointName));
});
window.addEventListener('pointermove', updatePrecisionDrag);
window.addEventListener('pointerup', endPrecisionDrag);
window.addEventListener('pointercancel', endPrecisionDrag);

ui.autorotateToggle.addEventListener('change', () => {
  controls.autoRotate = ui.autorotateToggle.checked;
  controls.autoRotateSpeed = 1.2;
});
ui.animationSelect.addEventListener('change', () => playAnimation(Number(ui.animationSelect.value)));
ui.playPauseButton.addEventListener('click', toggleAnimationPlayback);
ui.restartAnimationButton.addEventListener('click', () => {
  if (!activeAction) return;
  activeAction.reset().play();
  activeAction.paused = false;
  animationPlaying = true;
  ui.playPauseButton.textContent = 'Pause';
});
ui.treeSearch.addEventListener('input', () => filterTree(ui.treeSearch.value));
ui.clearIsolationButton.addEventListener('click', () => clearIsolation());
renderer.domElement.addEventListener('dblclick', handleDoubleClick);

function toggleCheckboxControl(input) {
  if (!input) return;
  input.checked = !input.checked;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function cycleViewMode() {
  const modes = ['textured-lighting', 'textured', 'clay', 'wireframe'];
  const index = modes.indexOf(currentMode);
  applyRenderMode(modes[(index + 1) % modes.length]);
}

window.addEventListener('keydown', (event) => {
  const tag = document.activeElement?.tagName?.toLowerCase();
  const editingField = tag === 'input' || tag === 'select' || tag === 'textarea';

  if ((event.ctrlKey || event.metaKey) && !event.altKey) {
    if (event.key.toLowerCase() === 'o') {
      event.preventDefault();
      openWithFileSystemPicker();
    } else if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (isGlbModel()) {
        if (event.shiftKey) saveAsCurrentGlb();
        else saveCurrentGlb();
      }
    }
    return;
  }
  if (event.altKey || editingField) return;

  if (precisionAlignActive) {
    if (event.key === 'Escape') {
      event.preventDefault();
      stopPrecisionAlign(true);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      applyPrecisionAlignment();
    }
    return;
  }

  const key = event.key.toLowerCase();
  if (key === 'f' && currentModel) fitObject(isolationTarget || currentModel, true);
  else if (key === 'v') cycleViewMode();
  else if (key === 'b') {
    boundsVisible = !boundsVisible;
    ui.boundsToggleButton.textContent = boundsVisible ? 'Hide box' : 'Show box';
    ui.boundsToggleButton.setAttribute('aria-pressed', String(boundsVisible));
    updateBoundsMeasurement();
  } else if (key === 'a') toggleCheckboxControl(ui.autorotateToggle);
  else if (key === 'l') toggleCheckboxControl(ui.lightingToggle);
  else if (key === 'p') setScalePersonVisible(!scalePersonVisible);
  else if (key === 'c') takeScreenshot();
  else if (key === 'q' && glbTransformEnabled) {
    ui.transformSpace.value = ui.transformSpace.value === 'local' ? 'world' : 'local';
    syncTransformPivotProxy();
  } else if (key === 'u' && glbTransformEnabled) {
    setUnifiedScaleEnabled(!unifiedScaleEnabled);
  } else if (event.key === 'Tab' && isGlbModel()) {
    event.preventDefault();
    setGlbTransformEnabled(!glbTransformEnabled);
  } else if (key === 'w' && event.shiftKey) {
    toggleCheckboxControl(ui.wireToggle);
  } else if (glbTransformEnabled && key === 'w') setTransformMode('translate');
  else if (glbTransformEnabled && key === 'e') setTransformMode('rotate');
  else if (glbTransformEnabled && key === 'r') setTransformMode('scale');
});

let dragDepth = 0;
window.addEventListener('dragenter', (event) => {
  event.preventDefault();
  dragDepth += 1;
  ui.viewport.classList.add('dragging');
});
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('dragleave', (event) => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) ui.viewport.classList.remove('dragging');
});
window.addEventListener('drop', async (event) => {
  event.preventDefault();
  dragDepth = 0;
  ui.viewport.classList.remove('dragging');
  if (event.dataTransfer?.files?.length) await loadFiles(event.dataTransfer.files);
});
window.addEventListener('beforeunload', releaseBlobUrls);

setStatus('Ready');
