# Sculpting UI Icons

## Overview

The sculpting UI mirrors the models panel, but is intentionally lighter so it doesn’t steal horizontal space or attention from the viewport. Interaction is centered around a single “Sculpt” toggle pinned to the top-left corner of the viewer. Tapping/clicking the toggle reveals a compact ribbon of sculpting tools—Smooth, Add, Remove—each represented by a circular button.

## Design Principles

- **One Toggle, Three Modes** – The sculpt toggle acts as both entry point and state indicator. It uses the same circular styling as the tool icons so the row reads as a cohesive control.
- **Icon-Only Buttons** – Each tool button contains a lightweight inline SVG with no built-in border; the circle border comes entirely from the button shell so all icons look identical in weight.
- **Label on Hover/Focus** – The text label (“Sculpt mode” by default) sits centered beneath the icon row. Hovering or focusing a tool updates the label to the tool’s name, providing clarity without adding extra UI chrome.
- **Floating Presentation** – The toggle and icons float over the viewer, matching the model panel’s translucent treatment but staying unobtrusive. Touch users tap the toggle to reveal or hide the tool row, while desktop users can leave it open while sculpting.
- **Direct Input Only** – Selecting a tool no longer spawns extra sliders. The sculpt brush always respects a predictable, finger-sized radius so interaction is as simple as dragging on the mesh.

## Behavior Notes

- The sculpt toggle is disabled until a model is loaded, mirroring the model panel behavior.
- Tool icons remain visually neutral until touched, but selecting one collapses the list and swaps the sculpt toggle icon to the chosen tool. Reopening the list temporarily restores the sculpt glyph so the toggle still reads as the entry point while browsing tools.
- Cursor picking relies on per-frame raycasts, so clicking through a model’s negative space (like the hole of a horseshoe) registers as “outside” even if the bounding box overlaps.
- The sculpt brush operates directly beneath the finger or cursor. Touch inputs assume roughly a 48px screen-space radius, while mouse/pen inputs use a tighter ~20–24px radius. Because the size is defined in screen space, zooming in/out naturally changes how much of the model is covered with every stroke.
- Dragging with the Smooth tool continuously averages the vertices under the active pointer, so the surface is gently blended in real time without separate confirmation or visual highlights.
- Clicking the viewport outside of any loaded mesh automatically hides whichever sculpt element is active: if a tool is selected it resets to the default sculpt state (collapsing the sliders), while an open tool list closes without selecting anything.
- The design leaves room to expand with more tools or status indicators without changing the core UX pattern.
