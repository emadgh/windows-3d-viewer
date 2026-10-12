import test from 'node:test';
import assert from 'node:assert/strict';
import { MeshStandardMaterial, MeshBasicMaterial, Texture, Color, DoubleSide } from 'three';
import { makeRenderMaterial, VIEW_PRESETS, renderMaterialKey } from '../src/render-materials.js';

function fixture() {
  return new MeshStandardMaterial({
    color: 0x99aabb, map: new Texture(), aoMap: new Texture(), lightMap: new Texture(),
    alphaMap: new Texture(), vertexColors: true, transparent: true, opacity: 0.6,
    alphaTest: 0.3, side: DoubleSide, depthWrite: false, roughness: 0.4, metalness: 0.2,
  });
}

test('textures-only excludes vertex colors, AO/lightmaps, scene lighting and tone mapping', () => {
  const original = fixture();
  const material = makeRenderMaterial(original, { ...VIEW_PRESETS.textures, hasVertexColors: true });
  assert.ok(material.isMeshBasicMaterial);
  assert.equal(material.map, original.map);
  assert.equal(material.vertexColors, false);
  assert.equal(material.aoMap, null);
  assert.equal(material.lightMap, null);
  assert.equal(material.toneMapped, false);
  assert.equal(material.alphaMap, original.alphaMap);
  assert.equal(material.transparent, true);
  assert.equal(material.opacity, 0.6);
  assert.equal(material.alphaTest, 0.3);
  assert.equal(material.side, DoubleSide);
  assert.equal(material.depthWrite, false);
});

test('baked lighting combines textures, vertex colors and authored maps without viewer lighting', () => {
  const original = fixture();
  original.aoMapIntensity = 0.4;
  original.lightMapIntensity = 2;
  const material = makeRenderMaterial(original, { ...VIEW_PRESETS.baked, hasVertexColors: true });
  assert.ok(material.isMeshBasicMaterial);
  assert.equal(material.vertexColors, true);
  assert.equal(material.map, original.map);
  assert.equal(material.aoMap, original.aoMap);
  assert.equal(material.lightMap, original.lightMap);
  assert.equal(material.aoMapIntensity, 0.4);
  assert.equal(material.lightMapIntensity, 2);
});

test('vertex inspection ignores material tint/textures/baked maps, while missing vertex data is neutral gray', () => {
  for (const hasVertexColors of [true, false]) {
    const material = makeRenderMaterial(fixture(), { mode: 'vertex-colors', lighting: true, bakedMaps: true, vertexColors: false, hasVertexColors });
    assert.ok(material.isMeshBasicMaterial);
    assert.equal(material.map, null);
    assert.equal(material.alphaMap, null);
    assert.equal(material.aoMap, null);
    assert.equal(material.lightMap, null);
    assert.equal(material.vertexColors, hasVertexColors);
    assert.equal(material.color.getHex(), hasVertexColors ? 0xffffff : 0x787878);
    assert.equal(material.opacity, 1);
    assert.equal(material.transparent, false);
    assert.equal(material.toneMapped, false);
  }
});

test('lit variants preserve PBR properties and change layers independently without changing originals', () => {
  const original = fixture();
  const sourceColor = original.color.clone();
  const combinations = new Set();
  for (const vertexColors of [true, false]) {
    for (const bakedMaps of [true, false]) {
      const options = { mode: 'textured', lighting: true, vertexColors, bakedMaps, hasVertexColors: true };
      const material = makeRenderMaterial(original, options);
      assert.notEqual(material, original);
      assert.ok(material.isMeshStandardMaterial);
      assert.equal(material.vertexColors, vertexColors);
      assert.equal(material.aoMap, bakedMaps ? original.aoMap : null);
      assert.equal(material.lightMap, bakedMaps ? original.lightMap : null);
      assert.equal(material.map, original.map);
      assert.equal(material.roughness, original.roughness);
      assert.equal(material.metalness, original.metalness);
      combinations.add(renderMaterialKey(options));
    }
  }
  assert.equal(combinations.size, 4);
  assert.equal(original.vertexColors, true);
  assert.ok(original.aoMap && original.lightMap);
  assert.ok(original.color.equals(sourceColor));
});

test('viewer lighting can be enabled on authored unlit materials without altering them', () => {
  const original = new MeshBasicMaterial({ map: new Texture(), vertexColors: true });
  const material = makeRenderMaterial(original, { ...VIEW_PRESETS.lit, hasVertexColors: true });
  assert.ok(material.isMeshStandardMaterial);
  assert.equal(material.map, original.map);
  assert.notEqual(material, original);
  assert.ok(original.isMeshBasicMaterial);
});

test('clay ignores vertex colors and textured layers and supports viewer lighting on/off', () => {
  for (const lighting of [true, false]) {
    const material = makeRenderMaterial(fixture(), { mode: 'clay', lighting, vertexColors: true, bakedMaps: true, hasVertexColors: true, clayColor: '#123456' });
    assert.equal(Boolean(material.isMeshStandardMaterial), lighting);
    assert.equal(material.color.getHex(), new Color('#123456').getHex());
    assert.equal(material.vertexColors, false);
    assert.equal(material.map, null);
  }
});
