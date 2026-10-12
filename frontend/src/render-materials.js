import { Color, FrontSide, DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three';

export const VIEW_MODES = ['textured', 'vertex-colors', 'clay', 'wireframe'];
export const VIEW_PRESETS = {
  textures: { mode: 'textured', lighting: false, vertexColors: false, bakedMaps: false },
  baked: { mode: 'textured', lighting: false, vertexColors: true, bakedMaps: true },
  lit: { mode: 'textured', lighting: true, vertexColors: true, bakedMaps: true },
};

export function renderMaterialKey({ mode, lighting, vertexColors, bakedMaps }) {
  return `${mode}:${Number(lighting)}:${Number(vertexColors)}:${Number(bakedMaps)}`;
}

export function makeRenderMaterial(source, { mode, lighting, vertexColors, bakedMaps, hasVertexColors, clayColor = '#787878' }) {
  if (mode === 'wireframe') {
    return new MeshBasicMaterial({ color: 0x8296b0, wireframe: true, side: DoubleSide, toneMapped: false });
  }
  if (mode === 'clay') {
    return lighting
      ? new MeshStandardMaterial({ color: clayColor, roughness: 0.78, metalness: 0.02, side: source?.side ?? FrontSide })
      : new MeshBasicMaterial({ color: clayColor, side: source?.side ?? FrontSide, toneMapped: false });
  }
  if (mode === 'textured' && lighting && source?.clone) {
    // Display variants never modify authored materials used by GLB export.
    // glTF KHR_materials_unlit imports as MeshBasicMaterial. The viewer's
    // explicit lighting layer should also work for those older-game materials.
    const material = source.isMeshBasicMaterial
      ? new MeshStandardMaterial({
        color: source.color.clone(), map: source.map, alphaMap: source.alphaMap,
        aoMap: source.aoMap, aoMapIntensity: source.aoMapIntensity,
        lightMap: source.lightMap, lightMapIntensity: source.lightMapIntensity,
        transparent: source.transparent, opacity: source.opacity, alphaTest: source.alphaTest,
        side: source.side, depthWrite: source.depthWrite, depthTest: source.depthTest,
        roughness: 1, metalness: 0,
      })
      : source.clone();
    material.vertexColors = Boolean(vertexColors && hasVertexColors);
    if (!bakedMaps) {
      material.aoMap = null;
      material.lightMap = null;
    }
    material.needsUpdate = true;
    return material;
  }
  const inspectColors = mode === 'vertex-colors';
  return new MeshBasicMaterial({
    color: inspectColors ? new Color(hasVertexColors ? 0xffffff : 0x787878) : source?.color?.clone?.() || new Color(0xffffff),
    map: inspectColors ? null : source?.map || null,
    // Preserve cutouts in textured views; vertex inspection shows the raw mesh.
    alphaMap: inspectColors ? null : source?.alphaMap || null,
    aoMap: !inspectColors && bakedMaps ? source?.aoMap || null : null,
    aoMapIntensity: source?.aoMapIntensity ?? 1,
    lightMap: !inspectColors && bakedMaps ? source?.lightMap || null : null,
    lightMapIntensity: source?.lightMapIntensity ?? 1,
    vertexColors: Boolean(hasVertexColors && (inspectColors || vertexColors)),
    transparent: inspectColors ? false : Boolean(source?.transparent),
    opacity: inspectColors ? 1 : source?.opacity ?? 1,
    alphaTest: inspectColors ? 0 : source?.alphaTest ?? 0,
    side: source?.side ?? FrontSide,
    depthWrite: inspectColors ? true : source?.depthWrite ?? true,
    toneMapped: false,
  });
}
