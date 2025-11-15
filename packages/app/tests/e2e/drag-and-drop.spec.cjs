const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs/promises');
const { PNG } = require('pngjs');

const cubeFixture = path.resolve(__dirname, '../../public/samples/cube.gltf');
const objFixture = path.resolve(__dirname, '../../public/samples/cube.obj');
const stlFixture = path.resolve(__dirname, '../../public/samples/cube.stl');
const plyFixture = path.resolve(__dirname, '../../public/samples/cube.ply');

test.describe('Drag-and-drop viewer', () => {
  test('loads cube, hides prompt, and persists after reload', async ({ page }) => {
    await openEditor(page);

    const overlay = page.locator('.drop-message');
    await expect(overlay).toBeVisible();
    await expectSidebarHidden(page, true);
    await expectDropMessageCentered(page);

    await dropCube(page);

    await expect(overlay).toHaveClass(/hidden/);
    await expect(page.locator('.status')).toHaveText('');
    await expect(page.locator('.status')).toHaveClass(/is-empty/);
    await expect(page.locator('canvas')).toBeVisible();

    const materials = await getMaterialStates(page);
    expect(materials.length).toBeGreaterThan(0);
    expect(
      materials.every(
        (mat) =>
          mat.transparent === false &&
          mat.opacity === 1 &&
          mat.depthWrite === true
      )
    ).toBe(true);

    const centerPixel = await sampleCenterPixel(page);
    expect(isCloseToBackground(centerPixel)).toBe(false);

    await expect(page.locator('.model-row')).toHaveCount(1);
    await expectSidebarHidden(page, false);

    const modelStates = await getModelStates(page);
    expect(modelStates[0].visible).toBe(true);
    expect(modelStates[0].wireframe).toBe(false);

    const modelItem = page.locator('.model-row').first();
    const visibleToggle = modelItem.locator('button[data-role="visible-toggle"]');
    const wireframeToggle = modelItem.locator('button[data-role="wireframe-toggle"]');

    await visibleToggle.click();
    let updatedStates = await getModelStates(page);
    expect(updatedStates[0].visible).toBe(false);

    await visibleToggle.click();
    updatedStates = await getModelStates(page);
    expect(updatedStates[0].visible).toBe(true);

    await wireframeToggle.click();
    updatedStates = await getModelStates(page);
    expect(updatedStates[0].wireframe).toBe(true);

    await wireframeToggle.click();
    updatedStates = await getModelStates(page);
    expect(updatedStates[0].wireframe).toBe(false);

    await page.reload();
    await expect(page.locator('.drop-message')).toHaveClass(/hidden/);
    await expect(page.locator('.status')).toHaveClass(/is-empty/);
    await expect(page.locator('canvas')).toBeVisible();
    await expectSidebarHidden(page, false);
  });

  test('restores every loaded model after reload', async ({ page }) => {
    await openEditor(page);

    await dropCube(page, { fileName: 'first-model.gltf' });
    await dropCube(page, { fileName: 'second-model.gltf' });
    await expect(page.locator('.model-row')).toHaveCount(2);
    await expectUnloadGuard(page, true);

    await page.reload();
    await expect(page.locator('.model-row')).toHaveCount(2);

    const restored = await getModelStates(page);
    const names = restored.map((model) => model.name).sort();
    expect(names).toEqual(['first-model.gltf', 'second-model.gltf']);
    await expectUnloadGuard(page, true);
  });

  test('loads obj, stl, and ply models', async ({ page }) => {
    await openEditor(page);

    await dropModel(page, objFixture);
    await dropModel(page, stlFixture);
    await dropModel(page, plyFixture);

    await expect(page.locator('.model-row')).toHaveCount(3);
    const states = await getModelStates(page);
    expect(states.map((state) => state.name).sort()).toEqual([
      'cube.obj',
      'cube.ply',
      'cube.stl'
    ]);
  });

  test('touch devices import via choose button', async ({ page, context }) => {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', {
        configurable: true,
        get: () => 1
      });
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = (query) => {
        if (query.includes('(pointer: coarse)')) {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() {
              return false;
            }
          };
        }
        return originalMatchMedia(query);
      };
    });

    await openEditor(page);

    const button = page.locator('.drop-action');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('CHOOSE MODEL');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await button.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(cubeFixture);

    await expect(page.locator('.drop-message')).toHaveClass(/hidden/);
    await expect(page.locator('.model-row')).toHaveCount(1);

    const acceptAttr = await button.evaluate((el) => {
      const input = document.querySelector('input[type="file"]');
      return input?.getAttribute('accept');
    });
    expect(acceptAttr?.includes('application/sla')).toBe(true);
    expect(acceptAttr?.includes('application/vnd.ms-pki.stl')).toBe(true);
  });

  test('new tabs start empty even when other tabs have models', async ({ context }) => {
    const pageOne = await context.newPage();
    await openEditor(pageOne);
    await dropCube(pageOne, { fileName: 'seed-model.gltf' });
    await expect(pageOne.locator('.model-row')).toHaveCount(1);
    await expectUnloadGuard(pageOne, true);

    const pageTwo = await context.newPage();
    await openEditor(pageTwo, { clearStorage: false });
    await expect(pageTwo.locator('.model-row')).toHaveCount(0);
    await expectUnloadGuard(pageTwo, false);
  });

  test('warns before closing when models exist', async ({ context }) => {
    const guardedPage = await context.newPage();
    await openEditor(guardedPage);
    await dropCube(guardedPage, { fileName: 'guarded-model.gltf' });
    await expectUnloadGuard(guardedPage, true);

    const dialogHandled = new Promise((resolve) => {
      guardedPage.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('beforeunload');
        await dialog.dismiss();
        resolve(undefined);
      });
    });

    await guardedPage.close({ runBeforeUnload: true });
    await dialogHandled;
  });

  test('camera supports orbit, pan, and zoom interactions', async ({ page }) => {
    await openEditor(page);
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
  test('reloads each tab with its own model state', async ({ context }) => {
    const pageOne = await context.newPage();
    await openEditor(pageOne);
    await dropCube(pageOne, { fileName: 'tab-one-model.gltf' });
    await expect(pageOne.locator('.model-row')).toHaveCount(1);
    const firstStates = await getModelStates(pageOne);
    expect(firstStates[0]?.name).toBe('tab-one-model.gltf');

    const pageTwo = await context.newPage();
    await openEditor(pageTwo, { clearStorage: false });
    await dropCube(pageTwo, { fileName: 'tab-two-model.gltf' });
    const secondStates = await getModelStates(pageTwo);
    expect(secondStates.some((state) => state.name === 'tab-two-model.gltf')).toBe(
      true
    );

    await pageOne.reload();
    await expect(pageOne.locator('.model-row')).toHaveCount(1);
    const reloadedFirst = await getModelStates(pageOne);
    expect(reloadedFirst[0]?.name).toBe('tab-one-model.gltf');

    await pageTwo.reload();
    await expect(pageTwo.locator('.model-row')).toHaveCount(secondStates.length);
    const reloadedSecond = await getModelStates(pageTwo);
    const beforeNames = secondStates.map((state) => state.name).sort();
    const afterNames = reloadedSecond.map((state) => state.name).sort();
    expect(afterNames).toEqual(beforeNames);
  });
});

async function openEditor(page, options = {}) {
  await page.goto('/');
  if (options.clearStorage === false) {
    return;
  }
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
}

async function dropCube(page, options = {}) {
  await dropModel(page, cubeFixture, options);
}

async function dropModel(page, filePath, options = {}) {
  const dataTransfer = await createDataTransfer(page, filePath, options);
  const canvas = page.locator('canvas');
  await canvas.dispatchEvent('dragenter', { dataTransfer });
  await canvas.dispatchEvent('dragover', { dataTransfer });
  await canvas.dispatchEvent('drop', { dataTransfer });
  await expect(page.locator('.drop-message')).toHaveClass(/hidden/);
}

async function createDataTransfer(page, filePath, options = {}) {
  const fileName = options.fileName ?? path.basename(filePath);
  const buffer = await fs.readFile(filePath);
  const mime = options.mime ?? guessMimeType(fileName);

  const payload = {
    fileName,
    bytes: Array.from(buffer),
    mime
  };

  return page.evaluateHandle(({ fileName, bytes, mime }) => {
    const dt = new DataTransfer();
    const file = new File([new Uint8Array(bytes)], fileName, {
      type: mime
    });
    dt.items.add(file);
    return dt;
  }, payload);
}

function guessMimeType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.glb')) return 'model/gltf-binary';
  if (lower.endsWith('.gltf')) return 'model/gltf+json';
  if (lower.endsWith('.obj')) return 'text/plain';
  if (lower.endsWith('.stl')) return 'model/stl';
  if (lower.endsWith('.ply')) return 'application/octet-stream';
  return 'application/octet-stream';
}

async function getCameraState(page) {
  return page.evaluate(() => window.__NOISYSHAPE_DEBUG?.getCameraState());
}

async function getMaterialStates(page) {
  return page.evaluate(() => window.__NOISYSHAPE_DEBUG?.getMaterialStates() ?? []);
}

async function getModelStates(page) {
  return page.evaluate(() => window.__NOISYSHAPE_DEBUG?.getModelStates?.() ?? []);
}

async function hasUnloadGuard(page) {
  return page.evaluate(() => window.__NOISYSHAPE_DEBUG?.hasUnloadGuard?.() ?? false);
}

async function expectUnloadGuard(page, active) {
  await expect.poll(() => hasUnloadGuard(page)).toBe(active);
}

async function expectSidebarHidden(page, hidden) {
  const sidebar = page.locator('.sidebar');
  if (hidden) {
    await expect(sidebar).toHaveClass(/sidebar-hidden/);
  } else {
    await expect(sidebar).not.toHaveClass(/sidebar-hidden/);
  }
}

async function expectDropMessageCentered(page) {
  const viewportBox = await page.locator('.viewport').boundingBox();
  const overlayBox = await page.locator('.drop-message').boundingBox();
  if (!viewportBox || !overlayBox) {
    throw new Error('Unable to measure viewport/drop message');
  }
  const viewportCenter = {
    x: viewportBox.x + viewportBox.width / 2,
    y: viewportBox.y + viewportBox.height / 2
  };
  const overlayCenter = {
    x: overlayBox.x + overlayBox.width / 2,
    y: overlayBox.y + overlayBox.height / 2
  };
  const dx = Math.abs(viewportCenter.x - overlayCenter.x);
  const dy = Math.abs(viewportCenter.y - overlayCenter.y);
  expect(dx).toBeLessThan(5);
  expect(dy).toBeLessThan(5);
}

async function sampleCenterPixel(page) {
  const screenshot = await page.screenshot();
  const png = PNG.sync.read(screenshot);
  const x = Math.floor(png.width / 2);
  const y = Math.floor(png.height / 2);
  const idx = (y * png.width + x) * 4;
  const data = png.data;
  return {
    r: data[idx],
    g: data[idx + 1],
    b: data[idx + 2]
  };
}

function isCloseToBackground({ r, g, b }) {
  const bg = { r: 5, g: 7, b: 11 };
  const diff =
    Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b);
  return diff < 20;
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
