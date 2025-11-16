import { BufferAttribute, BufferGeometry } from 'three';

export type SculptAdjacency = {
  vertexCount: number;
  triangleCount: number;
  vertexNeighbors: number[][];
  vertexTriangles: number[][];
};

export function buildSculptAdjacency(geometry: BufferGeometry): SculptAdjacency {
  const positionAttr = geometry.getAttribute('position') as BufferAttribute | undefined;
  if (!positionAttr) {
    throw new Error('Missing position attribute for sculpt mesh');
  }
  const indexAttr = geometry.getIndex();
  const triangleCount = indexAttr ? indexAttr.count / 3 : positionAttr.count / 3;
  const vertexCount = positionAttr.count;
  const neighborSets: Array<Set<number>> = new Array(vertexCount);
  const vertexTriangles: number[][] = new Array(vertexCount);
  for (let i = 0; i < vertexCount; i += 1) {
    neighborSets[i] = new Set();
    vertexTriangles[i] = [];
  }
  for (let tri = 0; tri < triangleCount; tri += 1) {
    const base = tri * 3;
    const a = getTriangleVertexIndex(indexAttr, base + 0);
    const b = getTriangleVertexIndex(indexAttr, base + 1);
    const c = getTriangleVertexIndex(indexAttr, base + 2);
    vertexTriangles[a].push(tri);
    vertexTriangles[b].push(tri);
    vertexTriangles[c].push(tri);
    neighborSets[a].add(b);
    neighborSets[a].add(c);
    neighborSets[b].add(a);
    neighborSets[b].add(c);
    neighborSets[c].add(a);
    neighborSets[c].add(b);
  }
  return {
    vertexCount,
    triangleCount,
    vertexNeighbors: neighborSets.map((set) => Array.from(set)),
    vertexTriangles
  };
}

function getTriangleVertexIndex(indexAttr: BufferAttribute | null, index: number): number {
  if (indexAttr) {
    return Number(indexAttr.getX(index));
  }
  return index;
}
