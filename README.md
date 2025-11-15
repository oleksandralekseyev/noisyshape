# Noisyshape

Three moving parts: a Vite/TypeScript UI, a Three.js scene, and a WebAssembly core built from C++ via Emscripten. Keep everything simple, build everything from the repo root.

## Stack

- TypeScript + Vite for the client shell.
- Three.js (or similar) for rendering and scene tools.
- C++20 compiled to WebAssembly with CMake + Emscripten.

## Layout

```
/packages
  /app        # UI, scene code, Vite config, tests
  /core-wasm  # C++ sources, CMakeLists, toolchain files
/docs         # Specs and experiments
```

`packages/app/public/wasm` is where the compiled module is staged for local runs and deploy builds. Build or copy artifacts there when needed, but keep the directory git-ignored to avoid committing generated binaries.

## Quick Start

```bash
# 1. Install UI dependencies (run from repo root)
pnpm install --filter app

# 2. Build WASM locally (optional until core-wasm sources exist)
cmake -S packages/core-wasm -B packages/core-wasm/build -DEMSCRIPTEN=ON
cmake --build packages/core-wasm/build
cmake --install packages/core-wasm/build --prefix packages/app/public/wasm

# 3. Run the Three.js editor
cd packages/app
pnpm dev
```

For a quick manual test, open the running app and drag `packages/app/public/samples/cube.gltf` into the viewport—the placeholder cube (each face colored differently) loads instantly and hides the “Drop 3D Models” prompt.

## Testing

End-to-end checks run with Playwright and simulate dropping the bundled cube model:

```bash
# From repo root, install dependencies (once)
pnpm install --filter app

# Install browsers once per machine
cd packages/app && pnpm exec playwright install

# Run the entire suite (assets + e2e)
pnpm test

# Run only the app tests if needed
pnpm --filter app test
```

GitHub Actions (`.github/workflows/ci.yml`) runs the same suite on every push/PR, ensuring drag-and-drop continues to hide the prompt and display the model.

The Playwright suite also checks that orbit, pan, and zoom gestures move the camera, guaranteeing the scene stays interactive.

## WASM Dev Notes

All build workflows (local toolchain or Docker) live in `docs/wasm-dev-cycle.md`. Follow that guide whenever you need to rebuild the module; it explains how the artifacts flow into `packages/app/public/wasm` and when to commit them.

## Production Build

```bash
pnpm --filter app build
cmake --build packages/core-wasm/build -DCMAKE_BUILD_TYPE=Release
cmake --install packages/core-wasm/build --prefix packages/app/dist/wasm
```

Ship `packages/app/dist` (which now contains the WASM artifacts) to any static host, making sure `.wasm` files get `application/wasm` and compression.

## Launch Checklist

- UI bundle is clean (type checks, lint, Vitest).
- WASM module exports the ABI and passes math tests.
- Scene loads the default asset and invokes at least one WASM call.
- Docker path works the same as the local toolchain.
- CI artifacts are versioned and ready to deploy.
