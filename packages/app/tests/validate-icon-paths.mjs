import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const viewerPath = path.resolve(__dirname, '..', 'src', 'viewer.ts');
const disallowedPattern = /['"]\/icons\//;

let contents;

try {
  contents = await fs.readFile(viewerPath, 'utf8');
} catch (error) {
  console.error(`❌ Failed to read viewer source at ${viewerPath}: ${error}`);
  process.exit(1);
}

if (disallowedPattern.test(contents)) {
  console.error('❌ Viewer must not reference root-relative /icons paths; use import.meta.env.BASE_URL helpers.');
  process.exit(1);
}

console.log('✅ Viewer tools reference icons via the GitHub Pages-safe helper.');
