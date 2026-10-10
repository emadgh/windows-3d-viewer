import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bakeStaticModel } from '../src/bake-transform.js';

function vertices(root) {
  root.updateWorldMatrix(true, true);
  const result = [];
  root.traverse((node) => {
    if (!node.geometry || node.userData?.viewerHelper) return;
    const position = node.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      result.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld));
    }
  });
  return result;
}
function closeVector(actual, expected, epsilon = 2e-5) {
  assert.ok(actual.distanceTo(expected) < epsilon, `${actual.toArray()} differs from ${expected.toArray()}`);
}
function sameVertices(actual, expected) {
  assert.equal(actual.length, expected.length);
  actual.forEach((point, i) => closeVector(point, expected[i]));
}
function fixture() {
  const root = new THREE.Group();
  root.position.set(4, 2, -3);
  root.rotation.set(0.3, -0.6, 0.2);
  root.scale.set(2, 3, 0.7);
  const group = new THREE.Group();
  group.rotation.set(-0.4, 0.8, 0);
  group.position.set(2, 1, -4);
  const geometry = new THREE.BoxGeometry(2, 3, 4);
  const a = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  a.position.set(1, 2, 3);
  const b = new THREE.Mesh(geometry, a.material);
  b.position.set(-3, -1, 2);
  b.scale.set(-1, 0.5, 2);
  root.add(group);
  group.add(a, b);
  return { root, group, a, b, geometry };
}

test('nested nonuniform transforms, shared geometry and all pivot choices preserve world vertices', () => {
  for (const mode of ['object', 'center', 'bottom']) {
    const { root, a, b, geometry } = fixture();
    const scene = new THREE.Scene();
    scene.add(root);
    const expected = vertices(root);
    const box = new THREE.Box3().setFromObject(root, true);
    const pivot = mode === 'object' ? root.getWorldPosition(new THREE.Vector3()) : box.getCenter(new THREE.Vector3());
    if (mode === 'bottom') pivot.y = box.min.y;
    const originalPositions = geometry.attributes.position.array.slice();
    bakeStaticModel(root, pivot);
    sameVertices(vertices(root), expected);
    closeVector(root.getWorldPosition(new THREE.Vector3()), pivot);
    root.traverse((node) => {
      closeVector(node.scale, new THREE.Vector3(1, 1, 1));
      assert.equal(node.quaternion.angleTo(new THREE.Quaternion()), 0);
      if (node !== root) closeVector(node.position, new THREE.Vector3());
    });
    assert.notEqual(a.geometry, b.geometry);
    assert.deepEqual(geometry.attributes.position.array, originalPositions);
    const after = new THREE.Box3().setFromObject(root, true);
    closeVector(after.min, box.min);
    closeVector(after.max, box.max);
  }
});

test('reflection preserves front faces, normals and tangent handedness for indexed and non-indexed meshes', () => {
  for (const indexed of [true, false]) {
    let geometry = new THREE.BoxGeometry();
    geometry.computeTangents();
    if (!indexed) geometry = geometry.toNonIndexed();
    const mesh = new THREE.Mesh(geometry);
    mesh.scale.set(-2, 3, 0.5);
    bakeStaticModel(mesh, new THREE.Vector3());
    const baked = mesh.geometry;
    const [i, j, k] = [0, 1, 2].map((n) => baked.index.getX(n));
    const position = baked.attributes.position;
    const a = new THREE.Vector3().fromBufferAttribute(position, i);
    const b = new THREE.Vector3().fromBufferAttribute(position, j);
    const c = new THREE.Vector3().fromBufferAttribute(position, k);
    const faceNormal = b.sub(a).cross(c.sub(a)).normalize();
    const normal = new THREE.Vector3().fromBufferAttribute(baked.attributes.normal, i);
    assert.ok(faceNormal.dot(normal) > 0.9999);
    assert.equal(baked.attributes.tangent.getW(i), -geometry.attributes.tangent.getW(i));
  }
});

test('multiple bakes restore geometry sharing and original node transforms without accumulating error', () => {
  const { root, a, b, geometry } = fixture();
  const before = vertices(root);
  const first = bakeStaticModel(root, new THREE.Vector3(2, 0, 3));
  root.rotation.y = 0.7;
  const second = bakeStaticModel(root, new THREE.Vector3(4, 1, 2));
  second.restore();
  first.restore();
  sameVertices(vertices(root), before);
  assert.equal(a.geometry, geometry);
  assert.equal(b.geometry, geometry);
});

test('unsupported models and singular geometry reject before any geometry is replaced', () => {
  for (const feature of ['animation', 'skin', 'instance', 'morph', 'camera', 'light', 'zero']) {
    const { root, a, geometry } = fixture();
    const animations = feature === 'animation' ? [new THREE.AnimationClip()] : [];
    if (feature === 'skin') root.add(new THREE.SkinnedMesh(new THREE.BoxGeometry()));
    if (feature === 'instance') root.add(new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 1));
    if (feature === 'morph') geometry.morphAttributes.position = [geometry.attributes.position.clone()];
    if (feature === 'camera') root.add(new THREE.PerspectiveCamera());
    if (feature === 'light') root.add(new THREE.PointLight());
    if (feature === 'zero') root.children[0].children[1].scale.x = 0;
    const before = vertices(root);
    assert.throws(() => bakeStaticModel(root, new THREE.Vector3(), animations));
    assert.equal(a.geometry, geometry);
    sameVertices(vertices(root), before);
  }
});

test('bake works with a transformed parent and matrixAutoUpdate disabled', () => {
  const { root, a } = fixture();
  const parent = new THREE.Group();
  parent.position.set(-4, 1, 2);
  parent.rotation.set(0.1, 0.2, 0.3);
  parent.scale.set(2, 1, 3);
  parent.add(root);
  a.updateMatrix();
  a.matrixAutoUpdate = false;
  const before = vertices(root);
  const pivot = new THREE.Vector3(3, 4, 5);
  const bake = bakeStaticModel(root, pivot);
  sameVertices(vertices(root), before);
  closeVector(root.getWorldPosition(new THREE.Vector3()), pivot);
  bake.restore();
  sameVertices(vertices(root), before);
  assert.equal(a.matrixAutoUpdate, false);
});

// GLTFExporter uses the browser FileReader API even for texture-free GLBs.
class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
}
globalThis.FileReader = FileReader;

test('GLB export/reload retains baked vertices, actual pivot and identity rotation/scale', async () => {
  const { root } = fixture();
  const before = vertices(root);
  const pivot = new THREE.Vector3(3, 0, -2);
  const bake = bakeStaticModel(root, pivot);
  const buffer = await new GLTFExporter().parseAsync(root, { binary: true, trs: true });
  const loaded = await new GLTFLoader().parseAsync(buffer, '');
  sameVertices(vertices(loaded.scene), before);
  closeVector(loaded.scene.children[0].position, pivot);
  loaded.scene.traverse((node) => {
    closeVector(node.scale, new THREE.Vector3(1, 1, 1));
    assert.equal(node.quaternion.angleTo(new THREE.Quaternion()), 0);
  });
  bake.releaseOriginals();
  sameVertices(vertices(root), before);
});


test('quantized normalized positions are decoded before bake, preserving out-of-range coordinates', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Int16BufferAttribute([32767, 0, 0, 0, 32767, 0, 0, 0, 32767], 3, true));
  const mesh = new THREE.Mesh(geometry);
  mesh.position.set(10, 20, 30);
  mesh.scale.set(5, 6, 7);
  const before = vertices(mesh);
  bakeStaticModel(mesh, new THREE.Vector3());
  sameVertices(vertices(mesh), before);
  assert.ok(mesh.geometry.attributes.position.array instanceof Float32Array);
});


test('small valid scales allowed by the editing UI can be baked', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry());
  mesh.scale.setScalar(0.000001);
  const before = vertices(mesh);
  bakeStaticModel(mesh, new THREE.Vector3());
  sameVertices(vertices(mesh), before);
  closeVector(mesh.scale, new THREE.Vector3(1, 1, 1));
});
