import { Mesh, MeshBasicMaterial } from 'three';
import type { ModelEntry } from './types';

export function setModelVisibility(entry: ModelEntry, visible: boolean): void {
  entry.visible = visible;
  entry.object.visible = visible;
  updateWireframeVisibility(entry);
}

export function setModelWireframe(entry: ModelEntry, wireframe: boolean): void {
  entry.wireframe = wireframe;
  entry.object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh || !mesh.isMesh || mesh.userData?.wireframeOverlay) {
      return;
    }
    stripLegacyOverlays(mesh);
    applyWireframeToMaterials(mesh);
    const overlay = ensureWireframeOverlay(mesh);
    overlay.geometry = mesh.geometry;
    overlay.visible = wireframe && entry.visible;
  });
}

function updateWireframeVisibility(entry: ModelEntry): void {
  entry.object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh || !mesh.isMesh || mesh.userData?.wireframeOverlay) {
      return;
    }
    const overlay = findWireframeOverlay(mesh);
    if (overlay) {
      overlay.visible = entry.wireframe && entry.visible;
    }
  });
}

function applyWireframeToMaterials(mesh: Mesh): void {
  if (!('material' in mesh) || !mesh.material) {
    return;
  }
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.forEach((mat) => {
    if ('wireframe' in mat) {
      (mat as unknown as { wireframe?: boolean }).wireframe = false;
    }
  });
}

function ensureWireframeOverlay(mesh: Mesh): Mesh {
  const existing = findWireframeOverlay(mesh);
  if (existing) {
    return existing;
  }
  const material = new MeshBasicMaterial({
    color: 0x000000,
    wireframe: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    toneMapped: false
  });
  const overlay = new Mesh(mesh.geometry, material);
  overlay.userData.wireframeOverlay = true;
  overlay.userData.wireframeMode = 'mesh';
  overlay.renderOrder = (mesh.renderOrder || 0) + 1;
  overlay.frustumCulled = false;
  overlay.visible = false;
  mesh.add(overlay);
  return overlay;
}

function findWireframeOverlay(mesh: Mesh): Mesh | null {
  const child = mesh.children?.find(
    (candidate: any) =>
      candidate.userData?.wireframeOverlay === true &&
      candidate.userData?.wireframeMode === 'mesh' &&
      (candidate as Mesh).isMesh
  ) as Mesh | undefined;
  return child ?? null;
}

function stripLegacyOverlays(mesh: Mesh): void {
  if (!mesh.children || mesh.children.length === 0) {
    return;
  }
  mesh.children = mesh.children.filter(
    (child: any) =>
      child.userData?.wireframeOverlay !== true || child.userData?.wireframeMode === 'mesh'
  );
}
