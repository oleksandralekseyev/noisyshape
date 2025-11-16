import type {
  SculptWorkerBuildRequest,
  SculptWorkerMeshPayload,
  SculptWorkerMeshResult,
  SculptWorkerResponse
} from '../sculptStructures';

type SculptWorkerMessageEvent = {
  data: SculptWorkerBuildRequest;
};

type SculptWorkerScope = {
  addEventListener: (type: 'message', listener: (event: SculptWorkerMessageEvent) => void) => void;
  postMessage: (message: SculptWorkerResponse) => void;
};

const workerScope = self as unknown as SculptWorkerScope;

workerScope.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'build') {
    return;
  }
  handleBuildRequest(data);
});

function handleBuildRequest(message: SculptWorkerBuildRequest): void {
  try {
    const meshes = message.meshes.map((mesh) => buildMeshCentroids(mesh));
    const response: SculptWorkerResponse = {
      type: 'complete',
      modelId: message.modelId,
      meshes
    };
    workerScope.postMessage(response);
  } catch (error) {
    const response: SculptWorkerResponse = {
      type: 'error',
      modelId: message.modelId,
      message: error instanceof Error ? error.message : 'Failed to build sculpt data'
    };
    workerScope.postMessage(response);
  }
}

function buildMeshCentroids(mesh: SculptWorkerMeshPayload): SculptWorkerMeshResult {
  const triangleCount = mesh.indices.length / 3;
  const centroids = new Float32Array(triangleCount * 3);
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
  }
  return { meshId: mesh.meshId, centroids };
}
