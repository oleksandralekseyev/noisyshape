import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  Object3D,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SUPPORTED_EXTENSIONS = ['.glb', '.gltf'];

let lastMaterialStates: MaterialState[] = [];

export function createViewer(root: HTMLElement): void {
  const host = document.createElement('div');
  host.className = 'viewer';
  root.appendChild(host);

  const overlay = createOverlay('Drop 3D Models');
  const status = createStatus('Drop a .glb or .gltf file');
  host.append(overlay, status);

  const renderer = new WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color('#05070b');

  const camera = new PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.1, 1000);
  camera.position.set(4, 3, 6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = true;
  controls.enableZoom = true;
  exposeDebugInterface(camera, controls);

  setupLights(scene);

  const grid = new GridHelper(40, 40, new Color('#1f6feb'), new Color('#1f6feb'));
  grid.position.y = -0.0001;
  scene.add(grid);

  const loader = new GLTFLoader();
  let currentModel: Object3D | null = null;
  let hasLoadedModel = false;

  const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };

  animate();

  const handleResize = () => {
    const { clientWidth, clientHeight } = host;
    renderer.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  };

  window.addEventListener('resize', handleResize);

  setupDragAndDrop(host, async (file) => {
    if (!isSupported(file.name)) {
      statusMessage(status, 'Unsupported file. Use .glb or .gltf', true);
      return;
    }

    statusMessage(status, `Loading ${file.name}…`);

    try {
      await loadGltfFromFile(loader, file, (gltf) => {
        if (currentModel) {
          scene.remove(currentModel);
        }

        currentModel = gltf.scene;
        scene.add(gltf.scene);

        fitCameraToObject(camera, controls, gltf.scene);
        lastMaterialStates = collectMaterialStates(gltf.scene);

        if (!hasLoadedModel) {
          hasLoadedModel = true;
          hideOverlay(overlay);
        }

        statusMessage(status, '');
      });
    } catch (error) {
      console.error(error);
      statusMessage(status, 'Failed to load model. Check the console for details.', true);
    }
  });
}

function setupLights(scene: Scene): void {
  const ambient = new AmbientLight('#7f8c8d', 0.8);
  const key = new DirectionalLight('#ffffff', 1.2);
  key.position.set(5, 10, 7);
  const fill = new DirectionalLight('#6bb3ff', 0.6);
  fill.position.set(-6, 5, -4);
  scene.add(ambient, key, fill);
}

function createOverlay(text: string): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'drop-message';
  overlay.textContent = text;
  return overlay;
}

function hideOverlay(el: HTMLElement): void {
  el.classList.add('hidden');
}

function createStatus(text: string): HTMLDivElement {
  const status = document.createElement('div');
  status.className = 'status';
  status.textContent = text;
  if (!text) {
    status.classList.add('is-empty');
  }
  return status;
}

function statusMessage(el: HTMLElement, message: string, isError = false): void {
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.toggle('is-empty', message.length === 0);
}

function isSupported(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function setupDragAndDrop(container: HTMLElement, onFile: (file: File) => void): void {
  const dropSurface = document.createElement('div');
  dropSurface.className = 'drop-surface';
  container.appendChild(dropSurface);

  const toggleSurface = (active: boolean) => {
    dropSurface.classList.toggle('dragging', active);
  };

  const preventDefaults = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const hasFiles = (event: DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files');

  let dragDepth = 0;

  const handleDragEnter = (event: DragEvent) => {
    if (!hasFiles(event)) {
      return;
    }

    preventDefaults(event);
    dragDepth += 1;
    toggleSurface(true);
  };

  const handleDragLeave = (event: DragEvent) => {
    if (!hasFiles(event)) {
      return;
    }

    preventDefaults(event);
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      toggleSurface(false);
    }
  };

  const handleDrop = (event: DragEvent) => {
    if (!hasFiles(event)) {
      return;
    }

    preventDefaults(event);
    toggleSurface(false);
    dragDepth = 0;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }

    onFile(files[0]);
  };

  container.addEventListener('dragenter', handleDragEnter);
  container.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) {
      return;
    }
    preventDefaults(event);
  });
  container.addEventListener('dragleave', handleDragLeave);
  container.addEventListener('drop', handleDrop);

  window.addEventListener('dragover', preventDefaults);
  window.addEventListener('drop', preventDefaults);
}

function loadGltfFromFile(loader: GLTFLoader, file: File, onLoad: (gltf: GLTF) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    loader.load(
      objectUrl,
      (gltf) => {
        URL.revokeObjectURL(objectUrl);
        onLoad(gltf);
        resolve();
      },
      undefined,
      (error) => {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    );
  });
}

function fitCameraToObject(camera: PerspectiveCamera, controls: OrbitControls, object: Object3D): void {
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const fitHeightDistance = maxDim / (2 * Math.tan((Math.PI * camera.fov) / 360));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.4;

  const direction = new Vector3(0, 0, 1);
  camera.position.copy(
    center.clone().add(direction.set(1, 1, 1).normalize().multiplyScalar(distance))
  );
  controls.target.copy(center);
  controls.update();
}

type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
};

function exposeDebugInterface(camera: PerspectiveCamera, controls: OrbitControls): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.__NOISYSHAPE_DEBUG = {
    ...window.__NOISYSHAPE_DEBUG,
    getCameraState: () => ({
      position: camera.position.toArray() as [number, number, number],
      target: controls.target.toArray() as [number, number, number]
    }),
    getMaterialStates: () => lastMaterialStates
  };
}

declare global {
  interface Window {
    __NOISYSHAPE_DEBUG?: {
      getCameraState: () => CameraState;
      getMaterialStates: () => MaterialState[];
    };
  }
}

type MaterialState = {
  name: string;
  transparent: boolean;
  opacity: number;
  depthWrite: boolean;
};

function collectMaterialStates(object: Object3D): MaterialState[] {
  const materials: MaterialState[] = [];
  object.traverse((child) => {
    if ('material' in child && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        materials.push({
          name: mat.name || child.name,
          transparent: Boolean(mat.transparent),
          opacity: 'opacity' in mat ? (mat.opacity as number) : 1,
          depthWrite: 'depthWrite' in mat ? Boolean(mat.depthWrite) : true
        });
      });
    }
  });
  return materials;
}

export {};
