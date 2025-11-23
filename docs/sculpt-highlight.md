# Sculpt Highlight

## Intent
- Provide a GPU-driven brush preview for the sculpt Smooth tool that looks like a soft light spill instead of flat triangle tints.
- Keep pointer radius logic in screen space (48px touch, 24px pen, 20px mouse) so the preview scales naturally with zoom.

## Behavior
- The preview only appears while the Smooth tool is active and the pointer is over a mesh; it hides as soon as the pointer leaves, a different tool is chosen, or the sculpt palette is opened.
- The highlight is centered on the latest raycast hit point and fades out over roughly the outer 30% of the brush radius.
- Color matches our existing sculpt accent (`#29b6f6`) and uses additive blending with depth testing so it reads like a light on the surface without washing out the model.

## Rendering
- A single `Mesh` named `sculpt-highlight` lives in the scene; it reuses the target mesh’s geometry, world matrix, and layers on each update so deformations stay aligned without extra buffers.
- A custom `ShaderMaterial` handles the preview:
  - Vertex shader passes world-space position to the fragment stage.
  - Fragment shader computes distance from the world hit point; fragments outside the radius are discarded, and fragments inside fade using `smoothstep` for a soft edge.
  - Blending is additive; depth write is disabled, depth test stays on, and polygon offset plus a high render order keep the overlay above the source mesh without z-fighting.
  - Tone mapping is disabled to keep the glow color consistent across renderer settings.
- Uniforms updated per pointer move: `uCenter` (world hit point) and `uRadius` (world-space radius derived from the pointer type and viewport height). No CPU-side triangle filtering or geometry allocation.

## Performance
- GPU handles all coverage decisions; the CPU only updates two uniforms and copies the target transform, eliminating the per-frame triangle filtering that previously caused slow highlights and oversized selections on large faces.
- The highlight mesh never allocates new buffers; it simply swaps to the active mesh’s geometry.

## Testing
- `pnpm test:sculpt` validates that highlight updates propagate center/radius uniforms, reuse the target geometry, and reset correctly on clear.
