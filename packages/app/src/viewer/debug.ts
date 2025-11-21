import type { Object3D, PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ModelEntry } from './types';

export type MaterialState = {
  name: string;
  transparent: boolean;
  opacity: number;
  depthWrite: boolean;
  wireframe: boolean;
};

type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
};

declare global {
  interface Window {
    __NOISYSHAPE_DEBUG?: {
      getCameraState?: () => CameraState;
      getMaterialStates?: () => MaterialState[];
      getModelStates?: () => Array<{
        id: string;
        name: string;
        visible: boolean;
        wireframe: boolean;
      }>;
      hasUnloadGuard?: () => boolean;
      hitTestViewport?: (x: number, y: number) => boolean;
      getActiveSculptTool?: () => string | null;
      scaleModel?: (id: string, scale: number) => void;
    };
  }
}

export function collectMaterialStates(object: Object3D): MaterialState[] {
  const materials: MaterialState[] = [];
  object.traverse((child) => {
    if ('material' in child && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        materials.push({
          name: mat.name || child.name,
          transparent: Boolean(mat.transparent),
          opacity: 'opacity' in mat ? (mat.opacity as number) : 1,
          depthWrite: 'depthWrite' in mat ? Boolean(mat.depthWrite) : true,
          wireframe: 'wireframe' in mat ? Boolean(mat.wireframe) : false
        });
      });
    }
  });
  return materials;
}

export function exposeDebugInterface(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  getModels: () => ModelEntry[],
  getMaterialStates: () => MaterialState[],
  hasUnloadGuard: () => boolean
): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.__NOISYSHAPE_DEBUG = {
    ...window.__NOISYSHAPE_DEBUG,
    getCameraState: () => ({
      position: camera.position.toArray() as [number, number, number],
      target: controls.target.toArray() as [number, number, number]
    }),
    getMaterialStates,
    getModelStates: () => [],
    hasUnloadGuard,
    scaleModel: (id: string, scale: number) => {
      const entry = getModels().find((model) => model.id === id);
      if (!entry) {
        return;
      }
      entry.object.scale.setScalar(scale);
      entry.object.updateMatrixWorld(true);
    }
  };
}

export function updateModelDebugState(models: ModelEntry[]): void {
  if (typeof window === 'undefined' || !window.__NOISYSHAPE_DEBUG) {
    return;
  }
  window.__NOISYSHAPE_DEBUG.getModelStates = () =>
    models.map((model) => ({
      id: model.id,
      name: model.name,
      visible: model.visible,
      wireframe: model.wireframe
    }));
}
