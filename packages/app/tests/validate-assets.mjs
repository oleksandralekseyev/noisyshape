import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..', 'public', 'samples');
const cubePath = path.join(root, 'cube.gltf');

const report = (message) => {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
};

let raw;
try {
  raw = await fs.promises.readFile(cubePath, 'utf8');
} catch (error) {
  report(`Failed to read ${cubePath}: ${error}`);
  process.exit();
}

let gltf;
try {
  gltf = JSON.parse(raw);
} catch (error) {
  report(`Invalid JSON in cube.gltf: ${error}`);
  process.exit();
}

if (!Array.isArray(gltf.materials) || gltf.materials.length === 0) {
  report('cube.gltf must define at least one material for consistent shading.');
  process.exit();
}

const [material] = gltf.materials;
if (material.alphaMode && material.alphaMode !== 'OPAQUE') {
  report(`cube.gltf material alphaMode must be 'OPAQUE', received '${material.alphaMode}'.`);
}

if (material.pbrMetallicRoughness?.baseColorFactor?.[3] !== undefined) {
  const alpha = material.pbrMetallicRoughness.baseColorFactor[3];
  if (alpha !== 1) {
    report(`cube.gltf baseColor alpha must be 1, received ${alpha}.`);
  }
}

const hasOpaquePrimitive = gltf.meshes?.some((mesh) =>
  mesh.primitives?.some((primitive) => typeof primitive.material === 'number')
);

if (!hasOpaquePrimitive) {
  report('cube.gltf primitives must reference the declared material.');
}

if (process.exitCode === 1) {
  process.exit();
}

console.log('✅ Sample cube material looks solid.');
