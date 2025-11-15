const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs/promises');

const cubeFixture = path.resolve(__dirname, '../../public/samples/cube.gltf');

test.describe('Drag-and-drop viewer', () => {
  test('loads cube and hides prompt after drop', async ({ page }) => {
    await page.goto('/');

    const overlay = page.locator('.drop-message');
    await expect(overlay).toBeVisible();

    const dataTransfer = await createDataTransfer(page, cubeFixture);

    const dropSurface = page.locator('.drop-surface');
    await dropSurface.dispatchEvent('dragenter', { dataTransfer });
    await dropSurface.dispatchEvent('drop', { dataTransfer });

    await expect(overlay).toHaveClass(/hidden/);
    await expect(page.locator('.status')).toHaveText(/Loaded cube\.gltf/i);
    await expect(page.locator('canvas')).toBeVisible();
  });
});

async function createDataTransfer(page, filePath) {
  const fileName = path.basename(filePath);
  const buffer = await fs.readFile(filePath);

  const payload = {
    fileName,
    bytes: Array.from(buffer)
  };

  return page.evaluateHandle(({ fileName, bytes }) => {
    const dt = new DataTransfer();
    const file = new File([new Uint8Array(bytes)], fileName, {
      type: 'model/gltf+json'
    });
    dt.items.add(file);
    return dt;
  }, payload);
}
