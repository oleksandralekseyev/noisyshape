# Repository Guidelines

## General Principles

Search first, use the most standard and widely supported solution, and only propose features or architectures that respect the defaults of our frameworks and dependencies. If a feature needs unconventional behavior, revise the feature instead of bending the tools.

Every feature must have an accompanying Markdown spec inside `docs/`; if a requirement shows up in a prompt without an existing doc, create or update the appropriate `docs/*.md` entry and treat it as the single source of truth for architecture. 

Every change must also include test coverage (or updates to existing tests) so CI reflects the intended behavior—no feature lands without passing automated tests.
- Keep test files focused and lightweight; avoid bundling unrelated features into a single spec so failures are easier to triage and maintain.
- When debugging tests add logging via the test runner hooks or console output so we can inspect trace logs quickly; keep the logs concise and leave them in place so future investigations can reuse the signal without re-instrumenting.

## Project Structure & Module Organization

- `packages/app` – Vite/TypeScript client, Three.js scene utilities, Vitest/Playwright tests, `public/` assets (including staged WASM files under `public/wasm`).
- `packages/core-wasm` – C++20 sources, headers, and CMake build scripts targeting Emscripten; artifacts land in `build/`.
- `docs/` – Architecture notes, playbooks (e.g., `docs/wasm-dev-cycle.md`), and design references.

## Build, Test, and Development Commands

```bash
pnpm install --filter app         # install UI dependencies
pnpm dev --filter app             # start Vite with hot reload
pnpm --filter app build           # production bundle → packages/app/dist
cmake -S packages/core-wasm -B packages/core-wasm/build -DEMSCRIPTEN=ON
cmake --build packages/core-wasm/build
cmake --install packages/core-wasm/build --prefix packages/app/public/wasm
docker run … emscripten/emsdk:latest   # containerized WASM build (see docs/wasm-dev-cycle.md)
```

## Coding Style & Naming Conventions

- **TypeScript** – 2-space indent, `camelCase` for functions/vars, `PascalCase` for components, prefer ES modules, keep files focused (`sceneControls.ts`). Run ESLint/Prettier (when configured) before committing.
- **C++** – clang-format with LLVM style (4 spaces), headers in `include/`, implementations in `src/`, `snake_case` for functions unless matching external ABI, document exported functions in comments shared with TS wrappers.

## Testing Guidelines

- Vitest (`pnpm test`) for logic and utilities; colocate specs as `*.test.ts`.
- Playwright for interaction/smoke tests under `packages/app/tests/e2e`.
- GoogleTest for math kernels via `cmake --build … --target test`; mirror the coverage of every exported WASM function.
- Aim for deterministic seeds in procedural algorithms so CI snapshots remain stable; document any flaky cases.

## Commit & Pull Request Guidelines

- Commit format: `<scope>: <concise action>` (examples: `app: add orbit gizmo`, `core-wasm: optimize sdf blend`). Reference issue IDs when relevant.
- PR checklist: summary, test evidence (`pnpm test`, `cmake --build …`), screenshots for UI-facing changes, and mention of updated docs/config.
- Keep UI and WASM changes in separate commits where possible. Request reviewers from both areas when touching shared bindings or ABI.
