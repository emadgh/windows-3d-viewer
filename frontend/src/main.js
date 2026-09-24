import './style.css';
import './startup-file.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
  boundsTarget: document.querySelector('#boundsTarget'),
  dimensionX: document.querySelector('#dimensionX'),
  dimensionY: document.querySelector('#dimensionY'),
  dimensionZ: document.querySelector('#dimensionZ'),
  boundsScale: document.querySelector('#boundsScale'),
  transformPanel: document.querySelector('#transformPanel'),
  transformEnabled: document.querySelector('#transformEnabled'),
  transformModeButtons: Array.from(document.querySelectorAll('[data-transform-mode]')),
  transformSpace: document.querySelector('#transformSpace'),
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
const transformHelper = transformControls.getHelper();
transformHelper.visible = false;
transformHelper.userData.viewerHelper = true;
scene.add(transformHelper);

transformControls.addEventListener('mouseDown', () => {
  controls.enabled = false;
});
transformControls.addEventListener('mouseUp', () => {
  controls.enabled = true;
});
transformControls.addEventListener('objectChange', () => {
  updateTransformFields();
  updateBoundsMeasurement();
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

async function loadFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const primary = findPrimaryFile(files);
  if (!primary) {
    setStatus('No supported 3D model found in the selected files.', true);
    return;
  }

  clearCurrentModel();
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
  transformControls.setMode('translate');
  transformControls.setSpace('local');
  setTransformModeButtonState('translate');
  setGlbTransformEnabled(false);
  updateTransformFields();
}

function setGlbTransformEnabled(enabled) {
  glbTransformEnabled = Boolean(enabled && isGlbModel());
  ui.transformEnabled.checked = glbTransformEnabled;

  if (glbTransformEnabled) {
    transformControls.attach(currentModel);
    transformHelper.visible = true;
  } else {
    transformControls.detach();
    transformHelper.visible = false;
    controls.enabled = true;
  }

  ui.transformModeButtons.forEach((button) => { button.disabled = !glbTransformEnabled; });
  ui.transformSpace.disabled = !glbTransformEnabled;
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

function applyTransformFields() {
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
  currentModel.scale.set(
    Math.max(minScale, Math.abs(readFiniteInput(ui.transformScaleX, currentModel.scale.x))),
    Math.max(minScale, Math.abs(readFiniteInput(ui.transformScaleY, currentModel.scale.y))),
    Math.max(minScale, Math.abs(readFiniteInput(ui.transformScaleZ, currentModel.scale.z))),
  );

  currentModel.updateMatrixWorld(true);
  updateTransformFields();
  updateBoundsMeasurement();
}

function resetGlbTransform() {
  if (!isGlbModel() || !originalGlbTransform) return;
  currentModel.position.copy(originalGlbTransform.position);
  currentModel.quaternion.copy(originalGlbTransform.quaternion);
  currentModel.scale.copy(originalGlbTransform.scale);
  currentModel.updateMatrixWorld(true);
  updateTransformFields();
  updateBoundsMeasurement();
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
}

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

ui.openButton.addEventListener('click', () => ui.fileInput.click());
ui.emptyOpenButton.addEventListener('click', () => ui.fileInput.click());
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
ui.transformEnabled.addEventListener('change', () => setGlbTransformEnabled(ui.transformEnabled.checked));
ui.transformModeButtons.forEach((button) => {
  button.addEventListener('click', () => setTransformMode(button.dataset.transformMode));
});
ui.transformSpace.addEventListener('change', () => {
  if (!glbTransformEnabled) return;
  transformControls.setSpace(ui.transformSpace.value === 'world' ? 'world' : 'local');
});
[
  ui.transformPositionX, ui.transformPositionY, ui.transformPositionZ,
  ui.transformRotationX, ui.transformRotationY, ui.transformRotationZ,
  ui.transformScaleX, ui.transformScaleY, ui.transformScaleZ,
].forEach((input) => {
  input.addEventListener('change', applyTransformFields);
});
ui.resetTransformButton.addEventListener('click', resetGlbTransform);
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

window.addEventListener('keydown', (event) => {
  if (!glbTransformEnabled || event.ctrlKey || event.metaKey || event.altKey) return;
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
  if (event.key.toLowerCase() === 'w') setTransformMode('translate');
  else if (event.key.toLowerCase() === 'e') setTransformMode('rotate');
  else if (event.key.toLowerCase() === 'r') setTransformMode('scale');
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
