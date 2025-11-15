# Camera Roll Gestures

## Background

The viewer currently relies on Three.js `OrbitControls`, which provides orbit, pan, and dolly gestures. We recently experimented with adding “roll around view axis” gestures (Alt/Option + drag on desktop and two‑finger twist on touch devices) by layering custom quaternion math on top of OrbitControls. This approach rotates the camera, but it interferes with OrbitControls’ assumption that world-up remains constant—after rolling, orbit and pan gestures become inverted or behave inconsistently across platforms.

## Requested Enhancement

Implement camera roll support that:

1. Lets desktop users roll the camera with a modifier + drag (Alt/Option + left drag is the preferred UX).
2. Lets touch users roll via a two‑finger twist gesture.
3. Preserves all existing OrbitControls interactions (orbit, pan, zoom) before and after a roll with no inverted axes or drift.
4. Keeps the camera/target relationship stable so restoring persisted models or reloading the page maintains the rolled orientation when desired.
5. Includes automated coverage verifying that roll gestures do not alter subsequent orbit/pan direction, and that rolling works consistently on both pointer and touch inputs.

## Acceptance Criteria

- OrbitControls (or a replacement controller) should expose an explicit roll state that is applied after the standard update loop without corrupting its internal spherical coordinates.
- Alt/Option + left drag rotates clockwise/counter‑clockwise in the direction of the drag; releasing the modifier returns controls to normal.
- A two‑finger twist rotates the camera around its view axis while two-finger pan/pinch preserve their current behaviors.
- Automated Playwright tests validate both gesture types and confirm standard orbit/pan inputs behave identically before and after rolling.
