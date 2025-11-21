import { LineBasicMaterial, LineSegments, Mesh, WireframeGeometry } from 'three';
import type { ModelEntry } from './types';

export function setModelVisibility(entry: ModelEntry, visible: boolean): void {
  entry.visible = visible;
  entry.object.visible = visible;
  updateWireframeOverlays(entry);
}

export function setModelWireframe(entry: ModelEntry, wireframe: boolean): void {
  entry.wireframe = wireframe;
  entry.object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh || !mesh.isMesh) {
      return;
    }
    ensureWireframeOverlay(mesh);
  });
  updateWireframeOverlays(entry);
}

function ensureWireframeOverlay(mesh: Mesh): void {
  let overlay = mesh.children?.find(
    (child: any) => child.userData?.wireframeOverlay === true
  ) as LineSegments | undefined;
  if (!overlay) {
    const geometry = new WireframeGeometry(mesh.geometry);
    const material = new LineBasicMaterial({ color: 0x000000 });
    overlay = new LineSegments(geometry, material);
    overlay.userData.wireframeOverlay = true;
    overlay.visible = false;
    mesh.add(overlay);
  }
}

function updateWireframeOverlays(entry: ModelEntry): void {
  entry.object.traverse((child) => {
    const mesh = child as Mesh & {
      children?: Array<LineSegments & { userData?: Record<string, unknown> }>;
    };
    if (!mesh || !mesh.isMesh) {
      return;
    }
    mesh.children?.forEach((childMesh: LineSegments & { userData?: Record<string, unknown> }) => {
      if (childMesh.userData?.wireframeOverlay) {
        childMesh.visible = entry.wireframe && entry.visible;
      }
    });
  });
}
