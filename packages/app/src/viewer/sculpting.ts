import type { Intersection, Object3D, PerspectiveCamera, Scene } from 'three';
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  WebGLRenderer
} from 'three';

const TOUCH_RADIUS_PX = 48;
const POINTER_RADIUS_PX = 20;
const PEN_RADIUS_PX = 24;
const SMOOTHING_STRENGTH = 0.35;

export interface SculptHighlightController {
  update(params: {
    hit: Intersection<Object3D>;
    camera: PerspectiveCamera;
    renderer: WebGLRenderer;
    pointerType: string;
  }): void;
  clear(): void;
}

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

export function createSculptHighlight(scene: Scene): SculptHighlightController {
  const geometry = new BufferGeometry();
  const material = new MeshBasicMaterial({
    color: '#29b6f6',
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    side: DoubleSide
  });
  const highlightMesh = new Mesh(geometry, material);
  highlightMesh.visible = false;
  highlightMesh.frustumCulled = false;
  highlightMesh.matrixAutoUpdate = false;
  highlightMesh.renderOrder = 999;
  scene.add(highlightMesh);

  const writePositions = (values: Float32Array) => {
    if (values.length === 0) {
      geometry.setDrawRange(0, 0);
      highlightMesh.visible = false;
      return;
    }
    const existing = geometry.getAttribute('position') as Float32BufferAttribute | undefined;
    if (!existing || existing.array.length !== values.length) {
      geometry.setAttribute('position', new Float32BufferAttribute(values, 3));
    } else {
      existing.array.set(values);
      existing.needsUpdate = true;
    }
    geometry.computeVertexNormals();
    geometry.setDrawRange(0, values.length / 3);
    highlightMesh.visible = true;
  };

  const update: SculptHighlightController['update'] = ({ hit, camera, renderer, pointerType }) => {
    const mesh = findMesh(hit.object);
    if (!mesh) {
      clear();
      return;
    }
    mesh.updateMatrixWorld(true);
    const radiusPx = getPointerRadius(pointerType);
    const worldRadius = getWorldRadius(radiusPx, camera, renderer, hit.point);
    if (worldRadius <= 0) {
      clear();
      return;
    }
    const positions = computeSculptHighlightTriangles({
      mesh,
      hitPoint: hit.point,
      worldRadius
    });
    if (!positions || positions.length === 0) {
      clear();
      return;
    }
    writePositions(positions);
  };

  const clear = () => {
    writePositions(new Float32Array(0));
  };

  return { update, clear };
}

export function computeSculptHighlightTriangles({
  mesh,
  hitPoint,
  worldRadius
}: {
  mesh: Mesh;
  hitPoint: Vector3;
  worldRadius: number;
}): Float32Array | null {
  const geometry = mesh.geometry as BufferGeometry;
  const positionAttr = geometry.getAttribute('position');
  if (!positionAttr) {
    return null;
  }

  if (worldRadius <= 0) {
    return null;
  }

  const radiusSq = worldRadius * worldRadius;
  const vertices = new Map<number, Vector3>();
  const localVertex = new Vector3();
  const centroid = new Vector3();
  const positions: number[] = [];

  const getWorldVertex = (index: number) => {
    const cached = vertices.get(index);
    if (cached) {
      return cached;
    }
    const worldVertex = localVertex.fromBufferAttribute(positionAttr, index).clone();
    worldVertex.applyMatrix4(mesh.matrixWorld);
    vertices.set(index, worldVertex);
    return worldVertex;
  };

  const pushTriangle = (a: Vector3, b: Vector3, c: Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };

  const withinRadius = (a: Vector3, b: Vector3, c: Vector3) => {
    if (a.distanceToSquared(hitPoint) <= radiusSq) return true;
    if (b.distanceToSquared(hitPoint) <= radiusSq) return true;
    if (c.distanceToSquared(hitPoint) <= radiusSq) return true;
    centroid.copy(a).add(b).add(c).divideScalar(3);
    return centroid.distanceToSquared(hitPoint) <= radiusSq;
  };

  const indexAttr = geometry.getIndex();
  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i += 3) {
      const aIndex = indexAttr.getX(i);
      const bIndex = indexAttr.getX(i + 1);
      const cIndex = indexAttr.getX(i + 2);
      const a = getWorldVertex(aIndex);
      const b = getWorldVertex(bIndex);
      const c = getWorldVertex(cIndex);
      if (withinRadius(a, b, c)) {
        pushTriangle(a, b, c);
      }
    }
  } else {
    for (let i = 0; i < positionAttr.count; i += 3) {
      const a = getWorldVertex(i);
      const b = getWorldVertex(i + 1);
      const c = getWorldVertex(i + 2);
      if (withinRadius(a, b, c)) {
        pushTriangle(a, b, c);
      }
    }
  }

  return new Float32Array(positions);
}
