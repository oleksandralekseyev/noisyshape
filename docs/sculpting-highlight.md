# Sculpting Highlight Specification

## Purpose

When sculpting mode is active the cursor should preview the affected surface
area before applying any changes. The highlight must respond instantly as the
mouse moves and should accurately represent the subset of triangles that would
be touched by the brush radius slider.

## Requirements

- The cursor ray must project onto the active mesh and highlight every triangle
  whose centroid falls within the configured radius of the hit point.
- The radius slider in the sculpt controls (1–100) maps linearly to the mesh's
  bounding radius so the highlight always feels proportional to model size.
- Highlighting is only available when the sculpt controls are visible and a
  tool is selected; moving the pointer away or hiding the controls removes the
  highlight.

## Highlight Data Preparation

- Each mesh caches triangle centroids inside a flat `Float32Array`. The array
  stores `x/y/z` triplets so the main thread can compute distances directly
  without building custom KD or AABB trees.
- Centroid generation still happens in a dedicated worker that starts as soon
  as a model loads. The main thread sends mesh positions, indices, and
  identifiers, then waits for the worker's response while the UI shows the
  "Preparing sculpt data" chip.
- The worker replies with serialized centroid arrays (one per mesh). We rely
  on structured cloning instead of `SharedArrayBuffer` transfers so the app
  stays compatible without requiring cross-origin isolation headers.
- The cached centroid arrays are keyed by mesh UUID and power both highlighting
  and pointer hit checks, ensuring sculpt interactions use a single source of
  truth.

## Radius Queries

- When the pointer hovers over a mesh, the intersection point is converted to
  local space and the highlight radius (slider value × mesh bounding radius) is
  squared.
- The cached centroid array is scanned linearly; any centroid whose squared
  distance falls within the radius contributes its triangle index to the
  highlight overlay.
- This direct approach keeps the implementation simple and easy to audit while
  still fulfilling the "instant feedback" requirement for typical asset sizes.

## Loading Animation

- While the worker builds the centroid cache the associated mesh stays hidden
  and a "Preparing sculpt data" chip with a looping spinner is displayed near
  the sculpt toggle.
- The animation is global: if any mesh is still preparing the indicator stays
  visible. Once all meshes finish, the chip fades out and the models become
  visible in the scene.

## Highlight Presentation

- Highlighted triangles are rendered as a translucent overlay mesh that shares
  the exact triangle positions (transformed into world space) so the highlight
  hugs the surface.
- The overlay uses an additive cyan tint with depth testing disabled so it is
  always visible above the base mesh.
- When no triangles fall within the radius the overlay disappears completely.
