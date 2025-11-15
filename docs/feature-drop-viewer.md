# Initial Drag-and-Drop Viewer

## Overview

The first UI iteration focuses on a distraction-free drag-and-drop experience that lets users preview GLB/GLTF assets inside a WebGL scene powered by Three.js. The page opens with a centered “Drop 3D Models” prompt so contributors immediately know how to interact with the prototype.

## User Flow

1. The viewport renders a dark grid, subtle lighting, and the drop prompt.
2. When a user drags a file into the window, the drop surface highlights and the app keeps the browser from opening the file.
3. Dropping the first supported file (.glb or .gltf) hides the prompt, loads the model with `GLTFLoader`, and automatically frames the camera so the object fits the view.
4. Status text under the viewport reports progress (“Loading car.glb…”) or errors (“Unsupported file. Use .glb or .gltf”), then fades away once the mesh renders so the scene stays uncluttered.
5. Additional drops replace the current model and refocus the camera so the newest asset remains visible.

## Implementation Notes

- Located in `packages/app` (Vite + TypeScript). Entry point (`src/main.ts`) boots `createViewer`.
- `src/viewer.ts` wires Three.js (scene, renderer, OrbitControls, lights, grid) and the drag-and-drop lifecycle.
- Dropped files are piped through `URL.createObjectURL` and fed to `GLTFLoader`, so binary `.glb` files with embedded textures work without extra assets.
- Camera framing relies on the model’s bounding box to compute an offset vector; damping controls keep navigation smooth after the auto zoom.
- UI chrome (prompt, drop surface, status) lives in `src/style.css` and is intentionally minimal so the scene remains the focus; orbit/pan/zoom controls behave like standard Three.js navigation without extra hints. The drop surface is purely visual and only lights up when files enter the viewport, so camera gestures always hit the canvas.
- A sidebar lists every loaded model in a compact, headerless table with dedicated cells for model name, visibility, and wireframe toggles. It strips the file extension, drops column labels to free horizontal space, and replaces textual toggles with minimalist icons so the name column can stretch edge-to-edge while still fitting single-line rows with middle truncation for long names. Wireframes render as thin black triangle overlays layered atop the solid mesh so contributors can inspect topology without losing the shaded surface. Toggling updates the scene immediately so contributors can compare meshes without reloading.
- `packages/app/public/samples/cube.gltf` is a built-in test asset (vertex-colored cube with unique face colors) used to verify drag-and-drop behavior without sourcing external models. The file now declares an explicit opaque material so faces always look solid regardless of renderer defaults; `pnpm test` (or `pnpm --filter app test`) enforces this via the asset validator.
- Loaded models are persisted via `localStorage`, so refreshing the page restores the last imported mesh automatically. The persistence layer stores a base64 data URL plus file name and is cleared if restoration fails.
- Automated coverage: `packages/app/tests/e2e/drag-and-drop.spec.cjs` uses Playwright to simulate dropping the cube fixture, ensures the scene survives a reload, toggles visibility/wireframe controls, and then orbit/pan/zoom the camera. A lightweight debug hook (`window.__NOISYSHAPE_DEBUG.getCameraState()`) exposes camera, material, and model data exclusively for automated tests.
