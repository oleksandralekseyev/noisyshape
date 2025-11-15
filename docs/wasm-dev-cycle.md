# WASM Development Cycle

This document tracks how we build and ship the `core-wasm` module. The generated `.wasm` and loader files live under `packages/app/public/wasm` for staging and testing, but they stay out of git; rebuild them locally or in CI whenever you change the native code.

## Local Toolchain Flow

```bash
cd packages/core-wasm
cmake -S . -B build -DEMSCRIPTEN=ON
cmake --build build
cmake --install build --prefix ../app/public/wasm
```

- `build/` stores the CMake cache and intermediate objects.
- `cmake --install` mirrors release artifacts (e.g., `core.wasm`, `core.js`, debug symbols) into the UI’s `public/wasm` directory, which Vite serves in dev and copies into `dist/wasm` in production.
- Commit updates to `packages/app/public/wasm` whenever you intentionally change the WASM ABI; otherwise leave it untouched to avoid noisy diffs.

## Docker Flow

Use the stock Emscripten container so teammates do not need a local emsdk.

```bash
docker run --rm \
  -v "$(pwd)/packages/core-wasm:/src" \
  -v "$(pwd)/packages/app/public/wasm:/out" \
  -w /src emscripten/emsdk:latest \
  bash -lc "cmake -S . -B build -DEMSCRIPTEN=ON && cmake --build build --config Release && cmake --install build --prefix /out"
```

- Volume 1 keeps the build directory cached between runs.
- Volume 2 maps `/out` to the checked-in `public/wasm` folder so the artifacts are ready to commit.

## Testing

1. Build the module (local or Docker).
2. Run GoogleTest (`cmake --build build --target test`) for math kernels.
3. Launch the UI (`pnpm dev`) and trigger at least one WebAssembly call.

## Tips

- Run `cmake --build build --clean-first` if the ABI changes dramatically.
- If you need both debug and release builds, create separate build directories (`build-debug`, `build-release`) and point `cmake --install` at the same `../app/public/wasm` folder when you are ready to ship.
- When iterating rapidly, watch mode helps: `cmake --build build -t core -- -j` in one terminal and `pnpm dev` in another.
