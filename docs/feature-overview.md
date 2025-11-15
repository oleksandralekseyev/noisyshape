# Feature Overview

## Core Interactions

- **Centered Drop Prompt** – A “Drop 3D Models” message is positioned at the center of the viewport until a model is loaded. Dropping a `.glb/.gltf` file anywhere on the viewport triggers a load, hides the prompt, and updates status text.
- **Model Persistence** – The most recently loaded model is stored in `localStorage`. Refreshing the page automatically restores the model; the cache clears if restoration fails.
- **Three.js Controls** – OrbitControls enable orbit, pan, and zoom with standard mouse gestures. Tests ensure the camera responds correctly and wireframes respect depth.
- **Wireframe Overlay** – A black wireframe overlay appears on top of meshes when toggled, driven by the sidebar UI, so topology remains visible without losing solid shading.

## UI Panels

- **Status Chip** – Bottom-center chip shows progress/errors and fades away when the scene is ready.
- **Model Sidebar** – A right-hand panel stays hidden until at least one model loads. Each entry includes:
  - Visibility toggle (hides/shows the mesh)
  - Wireframe toggle (draws the overlay on top of the solid mesh)

## Tooling & Testing

- **Sample Asset** – `packages/app/public/samples/cube.gltf` (opaque, color-coded faces, outward normals) aids manual testing. `pnpm test:assets` validates materials, normals, and attributes.
- **Debug Hooks** – `window.__NOISYSHAPE_DEBUG` exposes camera state, material info, and model visibility/wireframe state for automated tests.
- **Playwright Coverage** – `packages/app/tests/e2e/drag-and-drop.spec.cjs` verifies drag-and-drop flow, persistence, sidebar toggles, camera movement, and wireframe overlays through screenshots and DOM assertions.
