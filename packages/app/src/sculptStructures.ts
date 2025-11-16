import type { Vector3 } from 'three';

export type SculptHighlightData = {
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
  centroids: Float32Array;
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
  data: SculptHighlightData,
  point: Vector3,
  radius: number,
  output: number[]
): number[] {
  output.length = 0;
  if (!data || radius <= 0) {
    return output;
  }
  const centroids = data.centroids;
  if (!centroids || centroids.length === 0) {
    return output;
  }
  const radiusSq = radius * radius;
  for (let i = 0; i < centroids.length; i += 3) {
    const dx = point.x - centroids[i];
    const dy = point.y - centroids[i + 1];
    const dz = point.z - centroids[i + 2];
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq <= radiusSq) {
      output.push(i / 3);
    }
  }
  return output;
}
