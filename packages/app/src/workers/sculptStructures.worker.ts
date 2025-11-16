import type {
  SculptWorkerBuildRequest,
  SculptWorkerMeshPayload,
  SculptWorkerMeshResult,
  SculptWorkerResponse,
  SerializedSculptNode,
  SerializedSculptTree
} from '../sculptStructures';

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', (event) => {
  const data = event.data as SculptWorkerBuildRequest;
  if (!data || data.type !== 'build') {
    return;
  }
  handleBuildRequest(data);
});

function handleBuildRequest(message: SculptWorkerBuildRequest): void {
  try {
    const meshes = message.meshes.map((mesh) => buildMeshStructure(mesh));
    const transfers: ArrayBuffer[] = [];
    meshes.forEach((mesh) => {
      transfers.push(mesh.tree.centroids.buffer, mesh.tree.order.buffer);
    });
    const response: SculptWorkerResponse = {
      type: 'complete',
      modelId: message.modelId,
      meshes
    };
    ctx.postMessage(response, transfers);
  } catch (error) {
    const response: SculptWorkerResponse = {
      type: 'error',
      modelId: message.modelId,
      message: error instanceof Error ? error.message : 'Failed to build sculpt data'
    };
    ctx.postMessage(response);
  }
}

function buildMeshStructure(mesh: SculptWorkerMeshPayload): SculptWorkerMeshResult {
  const triangleCount = mesh.indices.length / 3;
  const centroids = new Float32Array(triangleCount * 3);
  const order: number[] = new Array(triangleCount);
  for (let tri = 0; tri < triangleCount; tri += 1) {
    const offset = tri * 3;
    const ia = mesh.indices[offset] * 3;
    const ib = mesh.indices[offset + 1] * 3;
    const ic = mesh.indices[offset + 2] * 3;
    const ax = mesh.positions[ia];
    const ay = mesh.positions[ia + 1];
    const az = mesh.positions[ia + 2];
    const bx = mesh.positions[ib];
    const by = mesh.positions[ib + 1];
    const bz = mesh.positions[ib + 2];
    const cx = mesh.positions[ic];
    const cy = mesh.positions[ic + 1];
    const cz = mesh.positions[ic + 2];
    centroids[offset] = (ax + bx + cx) / 3;
    centroids[offset + 1] = (ay + by + cy) / 3;
    centroids[offset + 2] = (az + bz + cz) / 3;
    order[tri] = tri;
  }
  const nodes: SerializedSculptNode[] = [];
  if (triangleCount > 0) {
    buildNode(order, 0, triangleCount, centroids, nodes);
  }
  const typedOrder = Uint32Array.from(order);
  const tree: SerializedSculptTree = {
    nodes,
    order: typedOrder,
    centroids
  };
  return { meshId: mesh.meshId, tree };
}

const MAX_LEAF_SIZE = 32;

function buildNode(
  order: number[],
  start: number,
  end: number,
  centroids: Float32Array,
  nodes: SerializedSculptNode[]
): number {
  const nodeIndex = nodes.length;
  const bounds = computeBounds(order, start, end, centroids);
  const node: SerializedSculptNode = {
    min: bounds.min,
    max: bounds.max,
    start,
    count: end - start,
    left: -1,
    right: -1
  };
  nodes.push(node);
  const count = end - start;
  if (count <= MAX_LEAF_SIZE) {
    return nodeIndex;
  }
  const axis = pickAxis(bounds);
  sortRange(order, start, end, axis, centroids);
  const mid = start + Math.floor(count / 2);
  node.left = buildNode(order, start, mid, centroids, nodes);
  node.right = buildNode(order, mid, end, centroids, nodes);
  return nodeIndex;
}

type Bounds = {
  min: [number, number, number];
  max: [number, number, number];
};

function computeBounds(
  order: number[],
  start: number,
  end: number,
  centroids: Float32Array
): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = start; i < end; i += 1) {
    const triIndex = order[i];
    const offset = triIndex * 3;
    const x = centroids[offset];
    const y = centroids[offset + 1];
    const z = centroids[offset + 2];
    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }
  return { min, max };
}

function pickAxis(bounds: Bounds): 0 | 1 | 2 {
  const spanX = bounds.max[0] - bounds.min[0];
  const spanY = bounds.max[1] - bounds.min[1];
  const spanZ = bounds.max[2] - bounds.min[2];
  if (spanX >= spanY && spanX >= spanZ) {
    return 0;
  }
  if (spanY >= spanX && spanY >= spanZ) {
    return 1;
  }
  return 2;
}

function sortRange(
  order: number[],
  start: number,
  end: number,
  axis: number,
  centroids: Float32Array
): void {
  const slice = order.slice(start, end);
  slice.sort((a, b) => centroids[a * 3 + axis] - centroids[b * 3 + axis]);
  for (let i = 0; i < slice.length; i += 1) {
    order[start + i] = slice[i];
  }
}
