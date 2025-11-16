# GitHub Pages Deployment

## Goal

Automatically publish the Vite client in `packages/app` to GitHub Pages whenever the CI workflow finishes successfully on `main`. The deployment should only run after all required checks (currently the end-to-end tests) have passed.

## Build Inputs

- **Build command** – `pnpm --filter app build`
- **Output directory** – `packages/app/dist`
- **Static deploy target** – GitHub Pages environment named `github-pages`

## Workflow Outline

1. Keep the existing `CI` workflow trigger (`push` to `main` and pull requests) so tests continue to run for every change.
2. Add a build job that runs after tests (`needs: e2e`) on both pushes to `main` and pull requests. This job checks out the repo, installs dependencies, runs the production build, runs `actions/configure-pages` to prepare metadata, and uploads the `dist` directory with `actions/upload-pages-artifact`.
3. Add a final deploy job that depends on the build job. The deploy job grants `pages: write` and `id-token: write` permissions, uses the reserved `github-pages` environment, downloads the artifact implicitly via `actions/deploy-pages`, and publishes it. When the workflow originates from a pull request, GitHub Pages automatically publishes a preview URL tied to that PR; pushes to `main` promote to production.

## Operational Notes

- GitHub Pages settings for the repository must be configured to **Source: GitHub Actions** so deployments performed by the workflow become the live site.
- Pull requests receive preview deployments via GitHub Pages’ PR environments; only pushes to `main` update the production site.
- The environment URL emitted by `actions/deploy-pages` surfaces the published site link directly in each workflow run for traceability.
