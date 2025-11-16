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

## Acceleration Structure

- Each mesh requires a helper tree to speed up triangle queries. Use a
  straightforward KD-tree built from triangle centroids.
- The KD-tree is created inside a dedicated worker as soon as a model loads.
  The main thread sends the mesh positions, indices, and identifiers; the
  worker responds with the serialized tree.
- The worker result is cached per mesh (keyed by the mesh UUID). Pointer
  queries traverse the KD-tree to collect candidate triangles before running
  precise distance checks.
- The same cached structure also reports whether a pointer press lands on the
  mesh (we reuse the raycast hit and tree lookup to keep interactions
  consistent).

## Loading Animation

- While the worker builds the KD-tree the associated mesh stays hidden and a
  "Preparing sculpt data" chip with a looping spinner is displayed near the
  sculpt toggle.
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
