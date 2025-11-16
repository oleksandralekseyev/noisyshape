import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  WireframeGeometry
} from 'three';
import type { Intersection } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import {
  clearPersistedModels,
  getPersistedModels,
  persistModel,
  type StoredModel
} from './modelStorage';

const SUPPORTED_EXTENSIONS = ['.glb', '.gltf', '.obj', '.stl', '.ply'];

let lastMaterialStates: MaterialState[] = [];
const UNLOAD_WARNING = 'You have models loaded. Leaving will lose them.';
let unloadGuardActive = false;
const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
  event.preventDefault();
  event.returnValue = UNLOAD_WARNING;
  return UNLOAD_WARNING;
};

export function createViewer(root: HTMLElement): void {
  const host = document.createElement('div');
  host.className = 'viewer';
  root.appendChild(host);

  const viewport = document.createElement('div');
  viewport.className = 'viewport';
  host.appendChild(viewport);

  const allowTapImport = supportsTapImport();

  const overlay = createOverlay(allowTapImport ? '' : 'Drop 3D Models');
  const status = createStatus('Drop a .glb, .gltf, .obj, .stl, or .ply file');
  viewport.append(overlay, status);
  let panelActionButton: HTMLButtonElement | null = null;
  let overlayAction: HTMLButtonElement | null = null;

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
  exposeDebugInterface(camera, controls, () => models);

  setupLights(scene);

  const gltfLoader = new GLTFLoader();
  const objLoader = new OBJLoader();
  const stlLoader = new STLLoader();
  const plyLoader = new PLYLoader();

  const modelLoaders: ModelLoader[] = [
    createGltfModelLoader(gltfLoader),
    createObjModelLoader(objLoader),
    createStlModelLoader(stlLoader),
    createPlyModelLoader(plyLoader)
  ];

  const handleFile = async (file: File) => {
    if (!isSupported(file.name)) {
      statusMessage(status, 'Unsupported file. Use .glb, .gltf, .obj, .stl, or .ply', true);
      return;
    }

    statusMessage(status, `Loading ${file.name}…`);

    try {
      const loader = findModelLoader(modelLoaders, file.name);
      if (!loader) {
        throw new Error(`No loader for ${file.name}`);
      }
      const object = await loader.loadFromFile(file);
      applyModel(object, { name: file.name });
      void persistModel(file);
    } catch (error) {
      console.error(error);
      statusMessage(status, 'Failed to load model. Check the console for details.', true);
    }
  };

  const filePicker = createFilePicker(handleFile);
  viewport.appendChild(filePicker);

  if (allowTapImport) {
    overlayAction = document.createElement('button');
    overlayAction.type = 'button';
    overlayAction.className = 'drop-action overlay-action';
    overlayAction.textContent = 'LOAD MODEL';
    overlayAction.addEventListener('click', () => filePicker.click());
    overlay.appendChild(overlayAction);
    overlay.classList.add('drop-message-action');
  }
  const ensurePanelAction = () => {
    if (panelActionButton) {
      return panelActionButton;
    }
    panelActionButton = document.createElement('button');
    panelActionButton.type = 'button';
    panelActionButton.className = 'drop-action panel-action-button';
    panelActionButton.textContent = 'LOAD MODEL';
    panelActionButton.addEventListener('click', () => filePicker.click());
    return panelActionButton;
  };

  const models: ModelEntry[] = [];
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  type SceneIntersection = Intersection<Object3D>;
  const pickSceneIntersection = (ndcX: number, ndcY: number): SceneIntersection | null => {
    pointer.set(ndcX, ndcY);
    raycaster.setFromCamera(pointer, camera);
    let closest: SceneIntersection | null = null;
    models.forEach((entry) => {
      if (!entry.visible || !entry.object.visible) {
        return;
      }
      const hits = raycaster.intersectObject(entry.object, true);
      if (hits.length === 0) {
        return;
      }
      const [hit] = hits;
      if (!closest || hit.distance < closest.distance) {
        closest = hit;
      }
    });
    return closest;
  };
  const hitTestViewport = (ndcX: number, ndcY: number) => pickSceneIntersection(ndcX, ndcY) !== null;
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

  let panelOpen = !allowTapImport;

  const panelToggle = createPanelToggle(() => {
    if (models.length === 0) {
      return;
    }
    panelOpen = !panelOpen;
    updatePanelVisibility();
  });
  host.appendChild(panelToggle);

  const updatePanelVisibility = () => {
    const hasModels = models.length > 0;
    const shouldShowPanel = hasModels && panelOpen;
    panel.setVisible(shouldShowPanel);
    host.classList.toggle('panel-open', shouldShowPanel);
    panelToggle.disabled = !hasModels;
    panelToggle.classList.toggle('is-disabled', !hasModels);
    panelToggle.setAttribute('aria-expanded', String(shouldShowPanel));
    panelToggle.setAttribute('aria-label', shouldShowPanel ? 'Hide model list' : 'Show model list');
    updatePanelActions();
  };

  const updatePanelActions = () => {
    if (!allowTapImport) {
      return;
    }
    const hasModels = models.length > 0;
    if (overlayAction) {
      overlayAction.style.display = hasModels ? 'none' : '';
    }
    const shouldShowPanelAction = hasModels && panelOpen;
    if (shouldShowPanelAction) {
      panel.setAction(ensurePanelAction());
    } else {
      panel.setAction(null);
    }
  };

  const refreshPanel = () => {
    panel.render(models);
    updateModelDebugState(models);
    syncUnloadGuard(models.length > 0);
    updatePanelVisibility();
  };

  const applyModel = (object: Object3D, meta: { name: string }) => {
    object.name = meta.name;
    scene.add(object);

    const entry: ModelEntry = {
      id: createModelId(),
      name: meta.name,
      object,
      visible: true,
      wireframe: false
    };
    models.push(entry);

    fitCameraToObject(camera, controls, object);
    lastMaterialStates = collectMaterialStates(object);
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
    const loader = findModelLoader(modelLoaders, entry.name);
    if (!loader) {
      throw new Error(`No loader registered for ${entry.name}`);
    }
    const object = await loader.loadFromDataUrl(entry.name, entry.dataUrl);
    applyModel(object, { name: entry.name });
  };

  setupDragAndDrop(viewport, handleFile);

  refreshPanel();
  void restorePersistedModels();

  const tools = [
    { id: 'smooth', label: 'Smooth', icon: '/icons/smooth.svg' },
    { id: 'add', label: 'Add', icon: '/icons/add.svg' },
    { id: 'remove', label: 'Remove', icon: '/icons/remove.svg' }
  ];
  let activeTool: ToolDescriptor | null = null;

  const sculptHighlight = createSculptHighlight();
  scene.add(sculptHighlight);
  const hideSculptHighlight = () => {
    sculptHighlight.visible = false;
  };
  const showSculptHighlight = (point: Vector3) => {
    sculptHighlight.position.copy(point);
    sculptHighlight.visible = true;
  };
  const toolsPanel = createToolsPanel(tools, {
    onSelectionChange: (tool) => {
      activeTool = tool;
      if (activeTool) {
        toolsOpen = false;
        updateToolsVisibility();
      } else {
        syncToolControls();
        hideSculptHighlight();
      }
      updateToggleIcon();
    }
  });
  host.appendChild(toolsPanel.element);
  const toolControls = createToolControls();
  host.appendChild(toolControls.element);
  let toolsOpen = false;
  const toolsToggle = createToolsToggle(() => {
    toolsOpen = !toolsOpen;
    updateToolsVisibility();
  });
  const toggleIcon = toolsToggle.querySelector('img');
  const updateToggleIcon = () => {
    if (!toggleIcon) return;
    const descriptor = !toolsOpen && activeTool ? activeTool : null;
    if (descriptor) {
      toggleIcon.src = descriptor.icon;
      toggleIcon.alt = descriptor.label;
    } else {
      toggleIcon.src = '/icons/sculpt.svg';
      toggleIcon.alt = 'Sculpt';
    }
  };
  host.appendChild(toolsToggle);
  const syncToolControls = () => {
    const controlsVisible = Boolean(activeTool) && !toolsOpen;
    toolControls.setVisible(controlsVisible);
    if (!controlsVisible) {
      hideSculptHighlight();
    }
  };

  const updateToolsVisibility = () => {
    toolsPanel.setVisible(toolsOpen);
    toolsToggle.setAttribute('aria-expanded', String(toolsOpen));
    toolsToggle.setAttribute('aria-label', toolsOpen ? 'Hide sculpt tools' : 'Show sculpt tools');
    syncToolControls();
    updateToggleIcon();
  };
  updateToolsVisibility();
  updateToggleIcon();

  const getPointerNdc = (event: PointerEvent) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) {
      return null;
    }
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      y: -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    };
  };

  renderer.domElement.addEventListener('pointerdown', (event) => {
    const coords = getPointerNdc(event);
    if (!coords) {
      return;
    }
    const hit = pickSceneIntersection(coords.x, coords.y);
    if (hit) {
      if (activeTool && !toolsOpen) {
        showSculptHighlight(hit.point);
      }
      return;
    }
    if (activeTool) {
      toolsPanel.setActiveTool(null);
      hideSculptHighlight();
    }
    if (toolsOpen) {
      toolsOpen = false;
      updateToolsVisibility();
    }
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!activeTool || toolsOpen) {
      hideSculptHighlight();
      return;
    }
    const coords = getPointerNdc(event);
    if (!coords) {
      hideSculptHighlight();
      return;
    }
    const hit = pickSceneIntersection(coords.x, coords.y);
    if (hit) {
      showSculptHighlight(hit.point);
    } else {
      hideSculptHighlight();
    }
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    hideSculptHighlight();
  });

  const exposeSculptDebug = () => {
    if (typeof window === 'undefined') {
      return;
    }
    window.__NOISYSHAPE_DEBUG = {
      ...window.__NOISYSHAPE_DEBUG,
      hitTestViewport,
      getActiveSculptTool: () => activeTool?.id ?? null
    };
  };
  exposeSculptDebug();

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

function exposeDebugInterface(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  getModels: () => ModelEntry[]
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
    getMaterialStates: () => lastMaterialStates,
    getModelStates: () => [],
    hasUnloadGuard: () => unloadGuardActive,
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

type ModelPanelInstance = {
  element: HTMLElement;
  render: (models: ModelEntry[]) => void;
  setVisible: (visible: boolean) => void;
  setAction: (action: HTMLElement | null) => void;
};

function createModelPanel(handlers: ModelPanelHandlers): ModelPanelInstance {
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
  const actionSlot = document.createElement('div');
  actionSlot.className = 'panel-action';
  actionSlot.hidden = true;

  sidebar.append(header, list, actionSlot);

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
    },
    setAction: (action: HTMLElement | null) => {
      actionSlot.innerHTML = '';
      if (action) {
        actionSlot.appendChild(action);
        actionSlot.hidden = false;
      } else {
        actionSlot.hidden = true;
      }
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

type ToolDescriptor = { id: string; label: string; icon: string };

type ToolsPanel = {
  element: HTMLElement;
  setVisible: (visible: boolean) => void;
  setActiveTool: (toolId: string | null) => void;
};

type ToolsPanelHandlers = {
  onSelectionChange?: (tool: ToolDescriptor | null) => void;
};

function createToolsPanel(
  tools: ToolDescriptor[],
  handlers: ToolsPanelHandlers = {}
): ToolsPanel {
  const { onSelectionChange } = handlers;
  const panel = document.createElement('div');
  panel.className = 'tools-panel tools-hidden';

  const list = document.createElement('div');
  list.className = 'tools-list';

  const label = document.createElement('div');
  label.className = 'tools-label';
  label.textContent = 'Sculpt mode';

  panel.append(list, label);

  const toolMap = new Map(tools.map((tool) => [tool.id, tool]));
  const buttons = new Map<string, HTMLButtonElement>();
  let activeToolId: string | null = null;
  let defaultLabel = 'Sculpt mode';

  const setActiveToolInternal = (toolId: string | null, silent = false) => {
    activeToolId = toolId;
    buttons.forEach((btn, id) => {
      btn.classList.toggle('is-active', id === toolId);
    });
    const descriptor = toolId ? toolMap.get(toolId) ?? null : null;
    defaultLabel = descriptor?.label ?? 'Sculpt mode';
    label.textContent = defaultLabel;
    if (!silent) {
      onSelectionChange?.(descriptor);
    }
  };

  tools.forEach((tool) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tools-button';
    button.dataset.tool = tool.id;
    button.setAttribute('aria-label', tool.label);
    const img = document.createElement('img');
    img.src = tool.icon;
    img.alt = tool.label;
    button.appendChild(img);
    const showToolLabel = () => {
      label.textContent = tool.label;
    };
    const resetLabel = () => {
      label.textContent = defaultLabel;
    };
    button.addEventListener('mouseenter', showToolLabel);
    button.addEventListener('mouseleave', resetLabel);
    button.addEventListener('focus', showToolLabel);
    button.addEventListener('blur', resetLabel);
    button.addEventListener('click', () => {
      setActiveToolInternal(tool.id);
    });
    list.appendChild(button);
    buttons.set(tool.id, button);
  });

  setActiveToolInternal(null, true);

  return {
    element: panel,
    setVisible: (visible: boolean) => {
      panel.classList.toggle('tools-hidden', !visible);
    },
    setActiveTool: (toolId: string | null) => {
      if (toolId && !toolMap.has(toolId)) {
        setActiveToolInternal(null);
        return;
      }
      setActiveToolInternal(toolId ?? null);
    }
  };
}

function createToolsToggle(onToggle: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tools-toggle';
  button.setAttribute('aria-label', 'Show sculpt tools');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', onToggle);
  const icon = document.createElement('img');
  icon.src = '/icons/sculpt.svg';
  icon.alt = 'Sculpt';
  button.appendChild(icon);
  return button;
}

function createSculptHighlight(): Mesh {
  const geometry = new SphereGeometry(0.045, 16, 16);
  const material = new MeshBasicMaterial({
    color: '#8fd9ff',
    transparent: true,
    opacity: 0.65,
    depthTest: false
  });
  const highlight = new Mesh(geometry, material);
  highlight.visible = false;
  return highlight;
}

type ToolControls = {
  element: HTMLElement;
  setVisible: (visible: boolean) => void;
};

function createToolControls(): ToolControls {
  const container = document.createElement('div');
  container.className = 'tools-controls tools-controls-hidden';

  const createControl = (options: {
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
  }) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'tools-control';
    const track = document.createElement('div');
    track.className = 'tools-control-track';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(options.min);
    input.max = String(options.max);
    input.step = String(options.step);
    input.value = String(options.value);
    track.appendChild(input);
    const caption = document.createElement('span');
    caption.className = 'tools-control-label';
    caption.textContent = options.label;
    wrapper.append(track, caption);
    return wrapper;
  };

  container.append(
    createControl({ label: 'Radius', min: 1, max: 100, step: 1, value: 25 }),
    createControl({ label: 'Value', min: 0, max: 100, step: 1, value: 50 })
  );

  return {
    element: container,
    setVisible: (visible: boolean) => {
      container.classList.toggle('tools-controls-hidden', !visible);
    }
  };
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

function syncUnloadGuard(shouldWarn: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (shouldWarn && !unloadGuardActive) {
    window.addEventListener('beforeunload', beforeUnloadHandler);
    unloadGuardActive = true;
  } else if (!shouldWarn && unloadGuardActive) {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    unloadGuardActive = false;
  }
}

function createFilePicker(onFile: (file: File) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = [
    '.glb',
    '.gltf',
    '.obj',
    '.stl',
    '.ply',
    'model/gltf-binary',
    'model/gltf+json',
    'model/stl',
    'model/obj',
    'application/sla',
    'application/vnd.ms-pki.stl',
    'application/octet-stream'
  ].join(',');
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) {
      onFile(file);
    }
    input.value = '';
  });
  return input;
}

function createPanelToggle(onToggle: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'panel-toggle is-disabled';
  button.disabled = true;
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Show model list');
  const icon = document.createElement('span');
  icon.className = 'panel-toggle-icon';
  for (let i = 0; i < 3; i += 1) {
    const bar = document.createElement('span');
    bar.className = 'panel-toggle-bar';
    icon.appendChild(bar);
  }
  button.appendChild(icon);
  button.addEventListener('click', () => {
    if (button.disabled) {
      return;
    }
    onToggle();
  });
  return button;
}

function supportsTapImport(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const nav = window.navigator;
  const coarse = window.matchMedia
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  return (
    coarse ||
    'ontouchstart' in window ||
    (nav && typeof nav.maxTouchPoints === 'number' && nav.maxTouchPoints > 0)
  );
}

type ModelLoader = {
  extensions: string[];
  loadFromFile: (file: File) => Promise<Object3D>;
  loadFromDataUrl: (name: string, dataUrl: string) => Promise<Object3D>;
};

function createGltfModelLoader(loader: GLTFLoader): ModelLoader {
  const loadScene = (url: string) => loader.loadAsync(url).then((gltf) => gltf.scene);
  return {
    extensions: ['.glb', '.gltf'],
    loadFromFile: (file) => withObjectUrl(file, loadScene),
    loadFromDataUrl: (_, dataUrl) => withDataUrl(dataUrl, loadScene)
  };
}

function createObjModelLoader(loader: OBJLoader): ModelLoader {
  const loadScene = (url: string) => loader.loadAsync(url);
  return {
    extensions: ['.obj'],
    loadFromFile: (file) => withObjectUrl(file, loadScene),
    loadFromDataUrl: (_, dataUrl) => withDataUrl(dataUrl, loadScene)
  };
}

function createStlModelLoader(loader: STLLoader): ModelLoader {
  const loadMesh = async (url: string) => {
    const geometry = await loader.loadAsync(url);
    geometry.computeVertexNormals();
    return new Mesh(geometry, createSolidMaterial());
  };
  return {
    extensions: ['.stl'],
    loadFromFile: (file) => withObjectUrl(file, loadMesh),
    loadFromDataUrl: (_, dataUrl) => withDataUrl(dataUrl, loadMesh)
  };
}

function createPlyModelLoader(loader: PLYLoader): ModelLoader {
  const loadMesh = async (url: string) => {
    const geometry = await loader.loadAsync(url);
    geometry.computeVertexNormals?.();
    return new Mesh(geometry, createSolidMaterial());
  };
  return {
    extensions: ['.ply'],
    loadFromFile: (file) => withObjectUrl(file, loadMesh),
    loadFromDataUrl: (_, dataUrl) => withDataUrl(dataUrl, loadMesh)
  };
}

async function withObjectUrl<T>(file: File, load: (url: string) => Promise<T>): Promise<T> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await load(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function withDataUrl<T>(dataUrl: string, load: (url: string) => Promise<T>): Promise<T> {
  if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http')) {
    return load(dataUrl);
  }
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await load(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function findModelLoader(loaders: ModelLoader[], fileName: string): ModelLoader | undefined {
  const lower = fileName.toLowerCase();
  return loaders.find((loader) =>
    loader.extensions.some((ext) => lower.endsWith(ext))
  );
}

function createSolidMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0xcfd8dc,
    metalness: 0.1,
    roughness: 0.8
  });
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
