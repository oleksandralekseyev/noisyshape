const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs/promises');

const cubeFixture = path.resolve(__dirname, '../../public/samples/cube.gltf');

test.describe('Drag-and-drop viewer', () => {
  test('loads cube and hides prompt after drop', async ({ page }) => {
    await page.goto('/');

    const overlay = page.locator('.drop-message');
    await expect(overlay).toBeVisible();

    await dropCube(page);

    await expect(overlay).toHaveClass(/hidden/);
    await expect(page.locator('.status')).toHaveText('');
    await expect(page.locator('.status')).toHaveClass(/is-empty/);
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('camera supports orbit, pan, and zoom interactions', async ({ page }) => {
    await page.goto('/');
    await dropCube(page);

    const canvas = page.locator('canvas');

    const initial = await getCameraState(page);

    await orbit(page, canvas, { x: 120, y: -40 });
    const rotated = await getCameraState(page);
    expect(rotated.position).not.toEqual(initial.position);

    await pan(page, canvas, { x: 40, y: 30 });
    const panned = await getCameraState(page);
    expect(panned.target).not.toEqual(rotated.target);

    await zoom(page, -400);
    const zoomed = await getCameraState(page);
    expect(distance(zoomed)).toBeLessThan(distance(panned));
  });
});

async function dropCube(page) {
  const dataTransfer = await createDataTransfer(page, cubeFixture);
  const canvas = page.locator('canvas');
  await canvas.dispatchEvent('dragenter', { dataTransfer });
  await canvas.dispatchEvent('dragover', { dataTransfer });
  await canvas.dispatchEvent('drop', { dataTransfer });
  await expect(page.locator('.drop-message')).toHaveClass(/hidden/);
}

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

async function getCameraState(page) {
  return page.evaluate(() => window.__NOISYSHAPE_DEBUG?.getCameraState());
}

async function orbit(page, canvas, delta) {
  await drag(page, canvas, delta, 'left');
}

async function pan(page, canvas, delta) {
  await drag(page, canvas, delta, 'right');
}

async function drag(page, canvas, delta, button) {
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas bounding box not available');
  }
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down({ button });
  await page.mouse.move(startX + delta.x, startY + delta.y, { steps: 10 });
  await page.mouse.up({ button });
}

async function zoom(page, amount) {
  await page.mouse.wheel(0, amount);
}

function distance(state) {
  const [px, py, pz] = state.position;
  const [tx, ty, tz] = state.target;
  return Math.hypot(px - tx, py - ty, pz - tz);
}
