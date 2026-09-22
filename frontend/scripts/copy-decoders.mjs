import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, '..');
const source = resolve(frontendRoot, 'node_modules/three/examples/jsm/libs/draco/gltf');
const destination = resolve(frontendRoot, 'public/draco/gltf');

if (!existsSync(source)) {
  throw new Error(`Three.js Draco decoder directory was not found: ${source}`);
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true });
console.log(`Copied Draco decoders to ${destination}`);
