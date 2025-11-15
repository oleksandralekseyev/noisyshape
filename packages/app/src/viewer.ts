import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  LineBasicMaterial,
  LineSegments,
  Object3D,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  WireframeGeometry
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  clearPersistedModels,
  getPersistedModels,
  persistModel,
  type StoredModel
} from './modelStorage';

const SUPPORTED_EXTENSIONS = ['.glb', '.gltf'];

let lastMaterialStates: MaterialState[] = [];

export function createViewer(root: HTMLElement): void {
  const host = document.createElement('div');
  host.className = 'viewer';
  root.appendChild(host);

  const viewport = document.createElement('div');
  viewport.className = 'viewport';
  host.appendChild(viewport);

  const overlay = createOverlay('Drop 3D Models');
  const status = createStatus('Drop a .glb or .gltf file');
  viewport.append(overlay, status);

  const renderer = new WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  viewport.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color('#05070b');

  const camera = new PerspectiveCamera(
    45,
    viewport.clientWidth / viewport.clientHeight,
    0.1,
    1000
  );
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
  const models: ModelEntry[] = [];
  let hasLoadedModel = false;

  const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };

  animate();

  const handleResize = () => {
    const { clientWidth, clientHeight } = viewport;
    renderer.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  };

  window.addEventListener('resize', handleResize);

  const panel = createModelPanel({
    onVisibilityChange: (id, visible) => {
      const entry = models.find((model) => model.id === id);
      if (!entry) return;
      setModelVisibility(entry, visible);
      refreshPanel();
    },
    onWireframeChange: (id, wireframe) => {
      const entry = models.find((model) => model.id === id);
      if (!entry) return;
      setModelWireframe(entry, wireframe);
      refreshPanel();
    }
  });
  host.appendChild(panel.element);

  const refreshPanel = () => {
    panel.render(models);
    panel.setVisible(models.length > 0);
    updateModelDebugState(models);
  };

  const applyModel = (gltf: GLTF, meta: { name: string }) => {
    scene.add(gltf.scene);

    const entry: ModelEntry = {
      id: createModelId(),
      name: meta.name,
      object: gltf.scene,
      visible: true,
      wireframe: false
    };
    models.push(entry);

    fitCameraToObject(camera, controls, gltf.scene);
    lastMaterialStates = collectMaterialStates(gltf.scene);
    setModelWireframe(entry, false);
    setModelVisibility(entry, true);
    refreshPanel();

    if (!hasLoadedModel) {
      hasLoadedModel = true;
      hideOverlay(overlay);
    }

    statusMessage(status, '');
  };

  const restorePersistedModels = async () => {
    const stored = getPersistedModels();
    if (stored.length === 0) {
      return;
    }

    try {
      for (const entry of stored) {
        await restoreEntry(entry);
      }
      statusMessage(status, '');
    } catch (error) {
      console.error('Failed to restore persisted models', error);
      clearPersistedModels();
      statusMessage(status, 'Failed to restore previous models', true);
    }
  };

  const restoreEntry = async (entry: StoredModel) => {
    statusMessage(status, `Restoring ${entry.name}…`);
    await loadGltfFromDataUrl(loader, entry.dataUrl, (gltf) =>
      applyModel(gltf, { name: entry.name })
    );
  };

  setupDragAndDrop(viewport, async (file) => {
    if (!isSupported(file.name)) {
      statusMessage(status, 'Unsupported file. Use .glb or .gltf', true);
      return;
    }

    statusMessage(status, `Loading ${file.name}…`);

    try {
      await loadGltfFromFile(loader, file, (gltf) => applyModel(gltf, { name: file.name }));
      void persistModel(file);
    } catch (error) {
      console.error(error);
      statusMessage(status, 'Failed to load model. Check the console for details.', true);
    }
  });

  refreshPanel();
  void restorePersistedModels();
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
    dropSurface.style.pointerEvents = active ? 'auto' : 'none';
  };

  toggleSurface(false);

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

async function loadGltfFromFile(loader: GLTFLoader, file: File, onLoad: (gltf: GLTF) => void): Promise<void> {
  const objectUrl = URL.createObjectURL(file);
  try {
    await loadGltfFromUrl(loader, objectUrl, onLoad);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadGltfFromDataUrl(
  loader: GLTFLoader,
  dataUrl: string,
  onLoad: (gltf: GLTF) => void
): Promise<void> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    await loadGltfFromUrl(loader, objectUrl, onLoad);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadGltfFromUrl(loader: GLTFLoader, url: string, onLoad: (gltf: GLTF) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        onLoad(gltf);
        resolve();
      },
      undefined,
      (error) => {
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
    getMaterialStates: () => lastMaterialStates,
    getModelStates: () => []
  };
}

declare global {
  interface Window {
    __NOISYSHAPE_DEBUG?: {
      getCameraState: () => CameraState;
      getMaterialStates: () => MaterialState[];
      getModelStates: () => Array<{
        id: string;
        name: string;
        visible: boolean;
        wireframe: boolean;
      }>;
    };
  }
}

type MaterialState = {
  name: string;
  transparent: boolean;
  opacity: number;
  depthWrite: boolean;
  wireframe: boolean;
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
          depthWrite: 'depthWrite' in mat ? Boolean(mat.depthWrite) : true,
          wireframe: 'wireframe' in mat ? Boolean(mat.wireframe) : false
        });
      });
    }
  });
  return materials;
}

type ModelEntry = {
  id: string;
  name: string;
  object: Object3D;
  visible: boolean;
  wireframe: boolean;
};

type ModelPanelHandlers = {
  onVisibilityChange: (id: string, visible: boolean) => void;
  onWireframeChange: (id: string, wireframe: boolean) => void;
};

function createModelPanel(handlers: ModelPanelHandlers) {
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';

  const header = document.createElement('div');
  header.className = 'panel-header';
  header.textContent = 'Models';

  const list = document.createElement('div');
  list.className = 'model-list';

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'model-table-wrapper';

  const table = document.createElement('table');
  table.className = 'model-table';

  const tableBody = document.createElement('tbody');
  tableBody.className = 'model-table-body';

  table.appendChild(tableBody);
  tableWrapper.appendChild(table);

  const empty = document.createElement('div');
  empty.className = 'model-empty';
  empty.textContent = 'Drop models to populate the list.';

  list.append(tableWrapper, empty);
  tableWrapper.hidden = true;
  empty.hidden = false;
  sidebar.append(header, list);

  const render = (models: ModelEntry[]) => {
    tableBody.innerHTML = '';
    const hasModels = models.length > 0;
    tableWrapper.hidden = !hasModels;
    empty.hidden = hasModels;

    if (!hasModels) {
      return;
    }

    models.forEach((model) => {
      const row = document.createElement('tr');
      row.className = 'model-row';
      row.dataset.id = model.id;

      const nameCell = document.createElement('td');
      nameCell.className = 'model-cell model-cell-name';
      const name = document.createElement('span');
      name.className = 'model-name';
      const displayName = getDisplayName(model.name);
      name.textContent = displayName;
      name.title = displayName;
      nameCell.appendChild(name);

      const visibleCell = document.createElement('td');
      visibleCell.className = 'model-cell model-cell-toggle model-cell-visible';
      const visibleButton = createIconToggle({
        active: model.visible,
        label: `Toggle visibility for ${displayName}`,
        role: 'visible-toggle',
        variant: 'visible'
      });
      visibleButton.addEventListener('click', () =>
        handlers.onVisibilityChange(model.id, !model.visible)
      );
      visibleCell.appendChild(visibleButton);

      const wireCell = document.createElement('td');
      wireCell.className = 'model-cell model-cell-toggle model-cell-wireframe';
      const wireButton = createIconToggle({
        active: model.wireframe,
        label: `Toggle wireframe for ${displayName}`,
        role: 'wireframe-toggle',
        variant: 'wireframe'
      });
      wireButton.addEventListener('click', () =>
        handlers.onWireframeChange(model.id, !model.wireframe)
      );
      wireCell.appendChild(wireButton);

      row.append(nameCell, visibleCell, wireCell);
      tableBody.appendChild(row);
      applyMiddleEllipsis(name, displayName);
    });
  };

  return {
    element: sidebar,
    render,
    setVisible: (visible: boolean) => {
      sidebar.classList.toggle('sidebar-hidden', !visible);
    }
  };
}

type IconToggleVariant = 'visible' | 'wireframe';

type IconToggleOptions = {
  active: boolean;
  label: string;
  role: string;
  variant: IconToggleVariant;
};

function createIconToggle(options: IconToggleOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  const classes = ['icon-toggle', `icon-toggle-${options.variant}`];
  if (options.active) {
    classes.push('is-active');
  }
  button.className = classes.join(' ');
  button.dataset.role = options.role;
  button.setAttribute('aria-pressed', options.active ? 'true' : 'false');
  button.setAttribute('aria-label', options.label);
  button.title = options.label;
  button.appendChild(createIcon(options.variant));
  return button;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function createIcon(variant: IconToggleVariant): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');

  if (variant === 'visible') {
    const outline = document.createElementNS(SVG_NS, 'path');
    outline.setAttribute(
      'd',
      'M2 12c2.8-4.4 6.4-6.6 10-6.6s7.2 2.2 10 6.6c-2.8 4.4-6.4 6.6-10 6.6S4.8 16.4 2 12Z'
    );
    const pupil = document.createElementNS(SVG_NS, 'circle');
    pupil.setAttribute('cx', '12');
    pupil.setAttribute('cy', '12');
    pupil.setAttribute('r', '3');
    svg.append(outline, pupil);
  } else {
    const square = document.createElementNS(SVG_NS, 'rect');
    square.setAttribute('x', '4');
    square.setAttribute('y', '4');
    square.setAttribute('width', '16');
    square.setAttribute('height', '16');
    const cross = document.createElementNS(SVG_NS, 'path');
    cross.setAttribute('d', 'M4 12h16M12 4v16M4 4l16 16M20 4 4 20');
    svg.append(square, cross);
  }

  return svg;
}

function getDisplayName(name: string): string {
  return stripModelExtension(name);
}

function stripModelExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0) {
    return name;
  }
  const extension = name.slice(dotIndex).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    return name;
  }
  return name.slice(0, dotIndex);
}

function applyMiddleEllipsis(el: HTMLElement, fullText: string): void {
  el.textContent = fullText;
  if (!el.isConnected) {
    return;
  }
  const available = el.clientWidth;
  if (available === 0) {
    requestAnimationFrame(() => {
      if (el.isConnected) {
        applyMiddleEllipsis(el, fullText);
      }
    });
    return;
  }
  if (el.scrollWidth <= available) {
    return;
  }
  const ellipsis = '…';
  let prefixLen = Math.ceil(fullText.length / 2);
  let suffixLen = fullText.length - prefixLen;
  while (prefixLen > 1 && suffixLen > 1) {
    const truncated = `${fullText.slice(0, prefixLen)}${ellipsis}${fullText.slice(
      fullText.length - suffixLen
    )}`;
    el.textContent = truncated;
    if (el.scrollWidth <= el.clientWidth) {
      return;
    }
    prefixLen -= 1;
    suffixLen -= 1;
  }
  el.textContent = `${fullText.slice(0, 1)}${ellipsis}${fullText.slice(-1)}`;
}

function setModelVisibility(entry: ModelEntry, visible: boolean): void {
  entry.visible = visible;
  entry.object.visible = visible;
  updateWireframeOverlays(entry);
}

function setModelWireframe(entry: ModelEntry, wireframe: boolean): void {
  entry.wireframe = wireframe;
  entry.object.traverse((child) => {
    const mesh = child as any;
    if (!mesh.isMesh) {
      return;
    }
    ensureWireframeOverlay(mesh);
  });
  updateWireframeOverlays(entry);
}

function createModelId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `model-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

function updateModelDebugState(models: ModelEntry[]): void {
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

function ensureWireframeOverlay(mesh: any): void {
  let overlay = mesh.children?.find(
    (child: any) => child.userData?.wireframeOverlay === true
  );
  if (!overlay) {
    const geometry = new WireframeGeometry(mesh.geometry);
    const material = new LineBasicMaterial({ color: 0x000000 });
    overlay = new LineSegments(geometry, material);
    overlay.userData.wireframeOverlay = true;
    overlay.visible = false;
    mesh.add(overlay);
  }
}

function updateWireframeOverlays(entry: ModelEntry): void {
  entry.object.traverse((child) => {
    const mesh = child as any;
    if (!mesh.isMesh) {
      return;
    }
    mesh.children?.forEach((childMesh: any) => {
      if (childMesh.userData?.wireframeOverlay) {
        childMesh.visible = entry.wireframe && entry.visible;
      }
    });
  });
}

export {};
