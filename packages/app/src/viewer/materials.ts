import { Mesh } from 'three';
import type { ModelEntry } from './types';

export function setModelVisibility(entry: ModelEntry, visible: boolean): void {
  entry.visible = visible;
  entry.object.visible = visible;
}

export function setModelWireframe(entry: ModelEntry, wireframe: boolean): void {
  entry.wireframe = wireframe;
  entry.object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh || !mesh.isMesh) {
      return;
    }
    stripLegacyOverlays(mesh);
    applyWireframeToMaterials(mesh, wireframe);
  });
}

function applyWireframeToMaterials(mesh: Mesh, wireframe: boolean): void {
  if (!('material' in mesh) || !mesh.material) {
    return;
  }
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.forEach((mat) => {
    if ('wireframe' in mat) {
      (mat as unknown as { wireframe?: boolean }).wireframe = wireframe;
    }
  });
}

function stripLegacyOverlays(mesh: Mesh): void {
  if (!mesh.children || mesh.children.length === 0) {
    return;
  }
  mesh.children = mesh.children.filter((child: any) => child.userData?.wireframeOverlay !== true);
}
