# GitHub Pages Deployment

## Goal

Automatically publish the Vite client in `packages/app` to GitHub Pages whenever the CI workflow finishes successfully on `main`. The deployment should only run after all required checks (currently the end-to-end tests) have passed, and every pull request should receive an isolated preview under `https://<user>.github.io/<repo>/pr-preview/pr-<number>/`.

## Build Inputs

- **Build command** – `pnpm --filter app build`
- **Output directory** – `packages/app/dist`
- **Static deploy branch** – `gh-pages` (root `/`)
- **Preview umbrella directory** – `pr-preview/`

## Workflow Outline

1. Keep the existing `CI` workflow trigger (`push` to `main` and pull requests) so tests continue to run for every change.
2. The `deploy-production` job in `.github/workflows/ci.yml` runs after `e2e`, only when `refs/heads/main` is being built. It checks out the repo, installs the UI dependencies, runs the production build, and publishes `packages/app/dist` to the `gh-pages` branch via `JamesIves/github-pages-deploy-action`. The deploy step uses `clean-exclude: pr-preview/` and `force: false` so that merged PRs do not erase active previews.

## PR Preview Workflow

- `.github/workflows/pr-preview.yml` listens for `pull_request` events (`opened`, `reopened`, `synchronize`, `closed`) and scopes concurrency via `preview-${{ github.ref }}` so only one preview deploy runs per PR at a time.
- For open/reopened/sync events the workflow installs dependencies, runs `pnpm --filter app build`, and calls `rossjrw/pr-preview-action@v1` with `source-dir: packages/app/dist`, `preview-branch: gh-pages`, and `umbrella-dir: pr-preview`. The action leaves a sticky comment that links to `https://<user>.github.io/<repo>/pr-preview/pr-<number>/`.
- When a pull request closes, the workflow skips the build, ensures `packages/app/dist` exists, and invokes the same action so the preview directory is removed.

## Base Path Handling

- Vite is configured with `base: './'` so the generated HTML references `./assets/...`, which keeps asset URLs relative to the deployed `index.html`. This makes the static bundle work whether it is hosted at `https://<user>.github.io/` or `https://<user>.github.io/noisyshape/`.
- The `packages/app/tests/validate-vite-base.mjs` check runs with `pnpm test:config` inside `pnpm test` to prevent regressions that could reintroduce absolute `/assets/...` references.
- UI code references icons via `import.meta.env.BASE_URL` helpers so `/icons/*.svg` requests stay relative to the deployed base path, and `packages/app/tests/validate-icon-paths.mjs` ensures future edits do not fall back to root-relative `/icons/...` URLs.

## Operational Notes

- GitHub Pages settings for the repository must be configured to **Source: Deploy from a branch → `gh-pages` / `/`** so both production and preview content come from the same branch.
- Repository settings under **Actions → General → Workflow permissions** must allow **Read and write** so workflows can push to `gh-pages` and post sticky comments.
- `pr-preview/` is reserved for preview builds; never delete or overwrite that directory during manual maintenance of the `gh-pages` branch.
