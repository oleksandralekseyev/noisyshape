import type { Intersection, Object3D, PerspectiveCamera } from 'three';
import { BufferGeometry, Matrix4, Mesh, Vector3, WebGLRenderer } from 'three';

const TOUCH_RADIUS_PX = 48;
const POINTER_RADIUS_PX = 20;
const PEN_RADIUS_PX = 24;
const SMOOTHING_STRENGTH = 0.35;

export function smoothAtIntersection({
  hit,
  camera,
  renderer,
  pointerType
}: {
  hit: Intersection<Object3D>;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  pointerType: string;
}): boolean {
  const mesh = findMesh(hit.object);
  if (!mesh) {
    return false;
  }
  const geometry = mesh.geometry as BufferGeometry;
  const positionAttr = geometry.getAttribute('position');
  if (!positionAttr || typeof positionAttr.setXYZ !== 'function') {
    return false;
  }

  const radiusPx = getPointerRadius(pointerType);
  const worldRadius = getWorldRadius(radiusPx, camera, renderer, hit.point);
  if (worldRadius <= 0) {
    return false;
  }

  const matrixWorld = mesh.matrixWorld;
  const inverse = new Matrix4().copy(matrixWorld).invert();
  const centroid = new Vector3();
  const selected: Array<{ index: number; position: Vector3 }> = [];
  const vertex = new Vector3();
  const worldVertex = new Vector3();

  for (let i = 0; i < positionAttr.count; i += 1) {
    vertex.fromBufferAttribute(positionAttr, i);
    worldVertex.copy(vertex).applyMatrix4(matrixWorld);
    if (worldVertex.distanceTo(hit.point) <= worldRadius) {
      centroid.add(worldVertex);
      selected.push({ index: i, position: worldVertex.clone() });
    }
  }

  if (selected.length === 0) {
    return false;
  }

  centroid.divideScalar(selected.length);
  const updated = new Vector3();
  selected.forEach(({ index, position }) => {
    updated.copy(position).lerp(centroid, SMOOTHING_STRENGTH).applyMatrix4(inverse);
    positionAttr.setXYZ(index, updated.x, updated.y, updated.z);
  });

  positionAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  return true;
}

function getPointerRadius(pointerType: string): number {
  if (pointerType === 'touch') {
    return TOUCH_RADIUS_PX;
  }
  if (pointerType === 'pen') {
    return PEN_RADIUS_PX;
  }
  return POINTER_RADIUS_PX;
}

function getWorldRadius(
  radiusPx: number,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  point: Vector3
): number {
  const distance = point.distanceTo(camera.position);
  const fovRadians = (camera.fov * Math.PI) / 180;
  const viewportHeight = renderer.domElement.clientHeight || 1;
  const worldHeightAtDistance = 2 * distance * Math.tan(fovRadians / 2);
  const worldPerPixel = worldHeightAtDistance / viewportHeight;
  return worldPerPixel * radiusPx;
}

function findMesh(object: Object3D): Mesh | null {
  let current: Object3D | null = object;
  while (current) {
    const maybeMesh = current as Mesh;
    if (maybeMesh.isMesh) {
      return maybeMesh;
    }
    current = current.parent;
  }
  return null;
}
