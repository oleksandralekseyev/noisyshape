import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Triangle,
  Vector3
} from 'three';

export type SculptHighlightTarget = {
  mesh: Mesh;
  point: Vector3;
};

const tempA = new Vector3();
const tempB = new Vector3();
const tempC = new Vector3();
const tempClosest = new Vector3();
const tempScale = new Vector3();
const tempTriangle = new Triangle();

export function createSculptHighlight(): Mesh {
  const geometry = new BufferGeometry();
  const material = new MeshBasicMaterial({
    color: '#8fd9ff',
    transparent: true,
    opacity: 0.45,
    depthTest: false,
    side: DoubleSide
  });
  const highlight = new Mesh(geometry, material);
  highlight.visible = false;
  highlight.renderOrder = 999;
  return highlight;
}

export function updateSculptHighlightMesh(
  highlight: Mesh,
  target: SculptHighlightTarget,
  radiusPercent: number
): boolean {
  const positions = collectHighlightedPositions(target, radiusPercent);
  const geometry = highlight.geometry as BufferGeometry;
  if (!positions || positions.length === 0) {
    geometry.setAttribute('position', new Float32BufferAttribute([], 3));
    highlight.visible = false;
    return false;
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  highlight.visible = true;
  return true;
}

function collectHighlightedPositions(
  target: SculptHighlightTarget,
  radiusPercent: number
): Float32Array | null {
  const mesh = target.mesh;
  const geometry = mesh.geometry;
  if (!(geometry instanceof BufferGeometry)) {
    return null;
  }
  const position = geometry.getAttribute('position');
  if (!position) {
    return null;
  }
  mesh.updateMatrixWorld(true);
  const radius = computeHighlightRadius(mesh, radiusPercent);
  if (radius <= 0) {
    return null;
  }
  const radiusSq = radius * radius;
  const positions: number[] = [];
  const index = geometry.index;
  const processTriangle = (aIndex: number, bIndex: number, cIndex: number) => {
    tempA.fromBufferAttribute(position, aIndex).applyMatrix4(mesh.matrixWorld);
    tempB.fromBufferAttribute(position, bIndex).applyMatrix4(mesh.matrixWorld);
    tempC.fromBufferAttribute(position, cIndex).applyMatrix4(mesh.matrixWorld);
    tempTriangle.set(tempA, tempB, tempC);
    tempTriangle.closestPointToPoint(target.point, tempClosest);
    if (tempClosest.distanceToSquared(target.point) <= radiusSq) {
      positions.push(
        tempA.x,
        tempA.y,
        tempA.z,
        tempB.x,
        tempB.y,
        tempB.z,
        tempC.x,
        tempC.y,
        tempC.z
      );
    }
  };

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      processTriangle(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    }
  } else {
    for (let i = 0; i < position.count; i += 3) {
      processTriangle(i, i + 1, i + 2);
    }
  }

  if (positions.length === 0) {
    return null;
  }

  return new Float32Array(positions);
}

export function computeHighlightRadius(mesh: Mesh, radiusPercent: number): number {
  const geometry = mesh.geometry as BufferGeometry | undefined;
  if (!geometry) {
    return 0;
  }
  if (!geometry.boundingSphere) {
    geometry.computeBoundingSphere();
  }
  const normalized = clampRadiusPercent(radiusPercent) / 100;
  const baseRadius = geometry.boundingSphere?.radius ?? 0;
  mesh.updateMatrixWorld(true);
  mesh.getWorldScale(tempScale);
  const scale = Math.max(tempScale.x, tempScale.y, tempScale.z);
  return baseRadius * scale * normalized;
}

function clampRadiusPercent(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}
