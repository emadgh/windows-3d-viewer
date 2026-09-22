import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, '..');

const copies = [
  {
    label: 'Draco',
    source: resolve(frontendRoot, 'node_modules/three/examples/jsm/libs/draco/gltf'),
    destination: resolve(frontendRoot, 'public/draco/gltf'),
  },
  {
    label: 'Basis/KTX2',
    source: resolve(frontendRoot, 'node_modules/three/examples/jsm/libs/basis'),
    destination: resolve(frontendRoot, 'public/basis'),
  },
];

for (const entry of copies) {
  if (!existsSync(entry.source)) {
    throw new Error(`${entry.label} decoder directory was not found: ${entry.source}`);
  }
  rmSync(entry.destination, { recursive: true, force: true });
  mkdirSync(entry.destination, { recursive: true });
  cpSync(entry.source, entry.destination, { recursive: true });
  console.log(`Copied ${entry.label} decoder assets to ${entry.destination}`);
}
