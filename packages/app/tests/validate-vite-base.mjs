import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfigFromFile } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const configPath = path.join(appRoot, 'vite.config.ts');
const expectedBase = './';

let loadedConfig;

try {
  const result = await loadConfigFromFile({ command: 'build', mode: 'production' }, configPath);
  loadedConfig = result?.config;
} catch (error) {
  console.error(`❌ Failed to load Vite config at ${configPath}: ${error}`);
  process.exit(1);
}

const actualBase = loadedConfig?.base;

if (actualBase !== expectedBase) {
  console.error(
    `❌ Vite base must be '${expectedBase}' for GitHub Pages compatibility (received '${actualBase ?? '<undefined>'}').`
  );
  process.exit(1);
}

console.log(`✅ Vite base path locked to '${expectedBase}' for GitHub Pages.`);
