# Sculpting Highlight Specification

## Purpose

When sculpting mode is active the cursor should preview the affected surface
area before applying any changes. The highlight must respond instantly as the
mouse moves and should accurately represent the subset of triangles that would
be touched by the on-screen finger or mouse radius.

## Requirements

- The cursor ray must project onto the active mesh and highlight only the
  front-most surface directly touched by the pointer. Back-facing or occluded
  triangles must never be highlighted.
- The radius slider in the sculpt controls (1–100) defines the radius in screen
  pixels so it approximates a fingertip on touch devices. Because the radius is
  screen-based, zooming in shrinks the world-space area while zooming out makes
  it larger.
- Highlighting is only available when the sculpt controls are visible and a
  tool is selected; moving the pointer away or hiding the controls removes the
  highlight.

## Surface Neighborhood

- Each mesh builds a simple adjacency map on the main thread as soon as it
  loads. The structure records per-vertex neighbors and the triangles touching
  each vertex.
- The raycast hit identifies the nearest vertex on the front-most triangle.
  That vertex becomes the root of a breadth-first search across connected
  vertices.
- Vertices are explored only while their world-space distance from the root
  stays within the projected finger radius. Every triangle touched by the
  visited vertices becomes part of the highlight.
- Because the traversal never crosses disjoint surfaces hidden behind the hit
  triangle, back-facing regions remain excluded without extra occlusion tests.

## Highlight Presentation

- Highlighted triangles are rendered as a translucent overlay mesh that shares
  the exact triangle positions (transformed into world space) so the highlight
  hugs the surface.
- The overlay uses an additive cyan tint with depth testing disabled so it is
  always visible above the base mesh.
- When no triangles fall within the radius the overlay disappears completely.
