import type { Vector3 } from 'three';

export type SerializedSculptNode = {
  min: [number, number, number];
  max: [number, number, number];
  start: number;
  count: number;
  left: number;
  right: number;
};

export type SerializedSculptTree = {
  nodes: SerializedSculptNode[];
  order: Uint32Array;
  centroids: Float32Array;
};

export type SculptWorkerMeshPayload = {
  meshId: string;
  positions: Float32Array;
  indices: Uint32Array;
};

export type SculptWorkerBuildRequest = {
  type: 'build';
  modelId: string;
  meshes: SculptWorkerMeshPayload[];
};

export type SculptWorkerMeshResult = {
  meshId: string;
  tree: SerializedSculptTree;
};

export type SculptWorkerBuildResponse = {
  type: 'complete';
  modelId: string;
  meshes: SculptWorkerMeshResult[];
};

export type SculptWorkerErrorResponse = {
  type: 'error';
  modelId: string;
  message: string;
};

export type SculptWorkerResponse =
  | SculptWorkerBuildResponse
  | SculptWorkerErrorResponse;

export function collectTrianglesWithinRadius(
  tree: SerializedSculptTree,
  point: Vector3,
  radius: number,
  output: number[]
): number[] {
  output.length = 0;
  if (tree.nodes.length === 0 || radius <= 0) {
    return output;
  }
  const stack: number[] = [0];
  const radiusSq = radius * radius;
  const centroids = tree.centroids;
  const order = tree.order;
  while (stack.length > 0) {
    const nodeIndex = stack.pop();
    if (nodeIndex === undefined) {
      continue;
    }
    const node = tree.nodes[nodeIndex];
    if (!node) {
      continue;
    }
    if (!aabbIntersectsSphere(node, point, radiusSq)) {
      continue;
    }
    if (node.left !== -1) {
      stack.push(node.left);
    }
    if (node.right !== -1) {
      stack.push(node.right);
    }
    if (node.left === -1 && node.right === -1) {
      const start = node.start;
      const end = start + node.count;
      for (let i = start; i < end; i += 1) {
        const triIndex = order[i];
        const centroidOffset = triIndex * 3;
        const dx = point.x - centroids[centroidOffset];
        const dy = point.y - centroids[centroidOffset + 1];
        const dz = point.z - centroids[centroidOffset + 2];
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq <= radiusSq) {
          output.push(triIndex);
        }
      }
    }
  }
  return output;
}

function aabbIntersectsSphere(
  node: SerializedSculptNode,
  point: Vector3,
  radiusSq: number
): boolean {
  let distSq = 0;
  const px = point.x;
  const py = point.y;
  const pz = point.z;
  const min = node.min;
  const max = node.max;
  distSq += distanceToRange(px, min[0], max[0]);
  distSq += distanceToRange(py, min[1], max[1]);
  distSq += distanceToRange(pz, min[2], max[2]);
  return distSq <= radiusSq;
}

function distanceToRange(value: number, min: number, max: number): number {
  if (value < min) {
    const delta = min - value;
    return delta * delta;
  }
  if (value > max) {
    const delta = value - max;
    return delta * delta;
  }
  return 0;
}
