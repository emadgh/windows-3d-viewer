import { Float32BufferAttribute, Matrix4, Vector3 } from 'three';

export function getBakeUnavailableReason(root, animations = []) {
  if (!root) return 'Open a GLB model first.';
  if (animations.length) return 'Reset XForm is available for static models; this model has animation clips.';
  let reason = '';
  root.traverse((node) => {
    if (node.userData?.viewerHelper) return;
    if (node.isSkinnedMesh || node.isBone || node.isInstancedMesh
      || Object.keys(node.geometry?.morphAttributes || {}).length) {
      reason = 'Reset XForm is unavailable for skins, instances, or morph targets.';
    } else if (node.isCamera || node.isLight) {
      reason = 'Reset XForm is unavailable for models containing cameras or lights.';
    }
  });
  return reason;
}

function prepareTransformAttributes(geometry) {
  // Quantized glTF attributes cannot hold arbitrary baked coordinates. Decode
  // normalized/interleaved values into float storage before transforming them.
  for (const name of ['position', 'normal', 'tangent']) {
    const source = geometry.attributes[name];
    if (!source || (!source.isInterleavedBufferAttribute && source.array instanceof Float32Array && !source.normalized)) continue;
    const values = new Float32Array(source.count * source.itemSize);
    const readers = ['getX', 'getY', 'getZ', 'getW'];
    for (let i = 0; i < source.count; i += 1) {
      for (let component = 0; component < source.itemSize; component += 1) {
        values[i * source.itemSize + component] = source[readers[component]](i);
      }
    }
    geometry.setAttribute(name, new Float32BufferAttribute(values, source.itemSize));
  }
}

function reverseWinding(geometry) {
  // Indexing non-indexed triangles avoids swapping every vertex attribute.
  if (!geometry.index) {
    const count = geometry.attributes.position.count;
    geometry.setIndex(Array.from({ length: count }, (_, index) => index));
  }
  const index = geometry.index;
  for (let i = 0; i + 2 < index.count; i += 3) {
    const second = index.getX(i + 1);
    index.setX(i + 1, index.getX(i + 2));
    index.setX(i + 2, second);
  }
  index.needsUpdate = true;
  const tangent = geometry.attributes.tangent;
  if (tangent) {
    for (let i = 0; i < tangent.count; i += 1) tangent.setW(i, -tangent.getW(i));
    tangent.needsUpdate = true;
  }
}

// Bake static nodes into a common, axis-aligned frame at the chosen pivot.
// Prepare every clone before changing the model; retain originals for Reset.
export function bakeStaticModel(root, pivotWorld, animations = []) {
  const reason = getBakeUnavailableReason(root, animations);
  if (reason) throw new Error(reason);
  root.updateWorldMatrix(true, true);
  const parentWorld = root.parent?.matrixWorld || new Matrix4();
  const parentDeterminant = parentWorld.determinant();
  if (!Number.isFinite(parentDeterminant) || parentDeterminant === 0) throw new Error('Cannot bake a singular parent transform.');
  const pivotLocal = pivotWorld.clone().applyMatrix4(parentWorld.clone().invert());
  const newRootWorld = parentWorld.clone().multiply(new Matrix4().makeTranslation(pivotLocal));
  const inverseFrame = newRootWorld.clone().invert();
  const entries = [];
  const bakedGeometries = new Set();
  try {
    root.traverse((node) => {
      if (node.userData?.viewerHelper) return;
      const matrix = inverseFrame.clone().multiply(node.matrixWorld);
      const entry = {
        node, geometry: node.geometry, position: node.position.clone(),
        quaternion: node.quaternion.clone(), scale: node.scale.clone(),
        matrix: node.matrix.clone(), matrixAutoUpdate: node.matrixAutoUpdate,
      };
      if (node.geometry) {
        const determinant = matrix.determinant();
        if (!Number.isFinite(determinant) || determinant === 0) throw new Error('Cannot bake a zero-scale transform.');
        entry.bakedGeometry = node.geometry.clone();
        bakedGeometries.add(entry.bakedGeometry);
        prepareTransformAttributes(entry.bakedGeometry);
        entry.bakedGeometry.applyMatrix4(matrix);
        if (node.isMesh && determinant < 0) reverseWinding(entry.bakedGeometry);
        entry.bakedGeometry.computeBoundingBox();
        entry.bakedGeometry.computeBoundingSphere();
      }
      entries.push(entry);
    });
  } catch (error) {
    bakedGeometries.forEach((geometry) => geometry.dispose());
    throw error;
  }
  for (const entry of entries) {
    const { node } = entry;
    if (entry.bakedGeometry) node.geometry = entry.bakedGeometry;
    node.position.copy(node === root ? pivotLocal : new Vector3());
    node.quaternion.identity();
    node.scale.set(1, 1, 1);
    node.updateMatrix();
  }
  root.updateMatrixWorld(true);
  return {
    restore() {
      for (const entry of entries) {
        const { node } = entry;
        if (entry.geometry) node.geometry = entry.geometry;
        node.position.copy(entry.position);
        node.quaternion.copy(entry.quaternion);
        node.scale.copy(entry.scale);
        node.matrix.copy(entry.matrix);
        node.matrixAutoUpdate = entry.matrixAutoUpdate;
        node.matrixWorldNeedsUpdate = true;
      }
      root.updateMatrixWorld(true);
      bakedGeometries.forEach((geometry) => geometry.dispose());
    },
    releaseOriginals() {
      new Set(entries.map((entry) => entry.geometry).filter(Boolean))
        .forEach((geometry) => geometry.dispose());
    },
  };
}
