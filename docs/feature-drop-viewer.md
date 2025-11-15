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
- Dropped files are piped through `URL.createObjectURL` and dispatched to the appropriate Three.js loader: `GLTFLoader` for `.glb/.gltf`, `OBJLoader` for `.obj`, `STLLoader` for `.stl`, and `PLYLoader` for `.ply`. Each format feeds the same rendering pipeline so contributors can preview whatever asset they have handy without intermediate tooling.
- Camera framing relies on the model’s bounding box to compute an offset vector; damping controls keep navigation smooth after the auto zoom.
- UI chrome (prompt, drop surface, status) lives in `src/style.css` and is intentionally minimal so the scene remains the focus; orbit/pan/zoom controls behave like standard Three.js navigation without extra hints. The drop surface is purely visual and only lights up when files enter the viewport, so camera gestures always hit the canvas. Touch devices hide the prompt copy entirely and instead reveal a rounded “LOAD MODEL” button wired to the same loader; once a model loads, the CTA moves into the floating panel so users can import additional assets without reloading.
- A sidebar now floats over the viewport as a translucent card controlled by a hamburger toggle anchored to the top-right corner. Desktop users automatically see the model list whenever at least one asset is loaded, while touch devices keep it hidden until the user taps `LOAD MODEL` (to import) and then the toggle button to reveal the list. The panel preserves the compact, headerless table layout: it strips file extensions, aligns visibility/wireframe icons, and forces single-line names with middle truncation so the overlay stays narrow. Wireframes render as thin black triangle overlays layered atop the solid mesh so contributors can inspect topology without losing the shaded surface. Toggling updates the scene immediately so contributors can compare meshes without reloading.
- A matching tools palette sits on the left: the sculpt toggle itself uses the same circular icon styling, and tapping it reveals a short row of circular icons (Smooth/Add/Remove) with the tool name centered underneath. The icons are lightweight inline SVGs, so hovering or focusing instantly updates the label (“Sculpt mode” by default) without extra chrome.
- `packages/app/public/samples/` ships multiple fixtures (`cube.gltf`, `cube.obj`, `cube.stl`, `cube.ply`) so the e2e suite can exercise every loader path without external dependencies; `pnpm test` (or `pnpm --filter app test`) enforces these via the asset validator.
- Loaded models persist per browser tab so reloading a specific editor restores the complete list of meshes that tab imported (not just the most recent one). Fresh tabs now start empty—even if other tabs have active models—so each browser tab manages its own state in isolation. The persistence layer stores base64 data URLs plus file names and is cleared if restoration fails.
- Automated coverage: `packages/app/tests/e2e/drag-and-drop.spec.cjs` uses Playwright to simulate dropping the cube fixture, ensures the scene survives a reload, toggles visibility/wireframe controls, and then orbit/pan/zoom the camera. A lightweight debug hook (`window.__NOISYSHAPE_DEBUG.getCameraState()`) exposes camera, material, and model data exclusively for automated tests.
- `docs/sculpting-ui.md` describes the sculpt palette styling and interaction details.
