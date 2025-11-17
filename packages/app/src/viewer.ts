import {
  ACESFilmicToneMapping,
  Color,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  type Intersection,
  type Object3D
} from 'three';
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
import type { ModelEntry, ToolDescriptor } from './viewer/types';
import { createModelPanel, createPanelToggle } from './viewer/modelPanel';
import { createToolsPanel, createToolsToggle } from './viewer/toolsPanel';
import { setupLights, fitCameraToObject } from './viewer/scene';
import { setupDragAndDrop } from './viewer/dragAndDrop';
import {
  collectMaterialStates,
  exposeDebugInterface,
  updateModelDebugState,
  type MaterialState
} from './viewer/debug';
import { setModelVisibility, setModelWireframe } from './viewer/materials';
import { buildModelLoaders, findModelLoader, type ModelLoader } from './viewer/modelLoaders';
import { smoothAtIntersection } from './viewer/sculpting';
import {
  createOverlay,
  hideOverlay,
  createStatus,
  statusMessage,
  createFilePicker
} from './viewer/ui';
import { supportsTapImport, isSupported, createModelId } from './viewer/support';

const normalizedBasePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const withBasePath = (relativePath: string) => {
  const cleanedPath = relativePath.replace(/^\//, '');
  return `${normalizedBasePath}/${cleanedPath}`;
};
const iconPath = (filename: string) => withBasePath(`icons/${filename}`);

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
  exposeDebugInterface(
    camera,
    controls,
    () => models,
    () => lastMaterialStates,
    () => unloadGuardActive
  );

  setupLights(scene);

  const modelLoaders: ModelLoader[] = buildModelLoaders({
    gltfLoader: new GLTFLoader(),
    objLoader: new OBJLoader(),
    stlLoader: new STLLoader(),
    plyLoader: new PLYLoader()
  });

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

  const tools: ToolDescriptor[] = [
    { id: 'smooth', label: 'Smooth', icon: iconPath('smooth.svg') },
    { id: 'add', label: 'Add', icon: iconPath('add.svg') },
    { id: 'remove', label: 'Remove', icon: iconPath('remove.svg') }
  ];
  let activeTool: ToolDescriptor | null = null;
  const sculptIconSrc = iconPath('sculpt.svg');
  const activeSculptPointers = new Set<number>();
  let toolsPanel: ReturnType<typeof createToolsPanel>;
  let toolsOpen = false;
  const applyActiveTool = (
    tool: ToolDescriptor | null,
    options: { fromPanel?: boolean } = {}
  ) => {
    activeTool = tool;
    if (!options.fromPanel) {
      toolsPanel.setActiveTool(tool ? tool.id : null);
    }
    if (activeTool) {
      toolsOpen = false;
    } else {
      activeSculptPointers.clear();
    }
    updateToolsVisibility();
  };

  toolsPanel = createToolsPanel(tools, {
    onSelectionChange: (tool) => {
      applyActiveTool(tool, { fromPanel: true });
    }
  });
  host.appendChild(toolsPanel.element);
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
      toggleIcon.src = sculptIconSrc;
      toggleIcon.alt = 'Sculpt';
    }
  };
  updateToggleIcon();
  host.appendChild(toolsToggle);

  const updateToolsVisibility = () => {
    toolsPanel.setVisible(toolsOpen);
    toolsToggle.setAttribute('aria-expanded', String(toolsOpen));
    toolsToggle.setAttribute('aria-label', toolsOpen ? 'Hide sculpt tools' : 'Show sculpt tools');
    updateToggleIcon();
  };
  updateToolsVisibility();

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
  const releasePointer = (pointerId: number) => {
    if (renderer.domElement.hasPointerCapture(pointerId)) {
      renderer.domElement.releasePointerCapture(pointerId);
    }
    activeSculptPointers.delete(pointerId);
  };

  renderer.domElement.addEventListener('pointerdown', (event) => {
    const coords = getPointerNdc(event);
    if (!coords) {
      return;
    }
    const hit = pickSceneIntersection(coords.x, coords.y);
    if (hit && activeTool && !toolsOpen && activeTool.id === 'smooth') {
      activeSculptPointers.add(event.pointerId);
      renderer.domElement.setPointerCapture(event.pointerId);
      smoothAtIntersection({
        hit,
        camera,
        renderer,
        pointerType: event.pointerType
      });
      return;
    }

    if (hit) {
      return;
    }

    if (activeTool) {
      applyActiveTool(null);
    }
    if (toolsOpen) {
      toolsOpen = false;
      updateToolsVisibility();
    }
  });

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!activeSculptPointers.has(event.pointerId)) {
      return;
    }
    if (toolsOpen || !activeTool || activeTool.id !== 'smooth') {
      releasePointer(event.pointerId);
      return;
    }
    const coords = getPointerNdc(event);
    if (!coords) {
      return;
    }
    const hit = pickSceneIntersection(coords.x, coords.y);
    if (hit) {
      smoothAtIntersection({
        hit,
        camera,
        renderer,
        pointerType: event.pointerType
      });
    }
  });

  const endPointer = (event: PointerEvent) => {
    if (activeSculptPointers.has(event.pointerId)) {
      releasePointer(event.pointerId);
    }
  };

  renderer.domElement.addEventListener('pointerup', endPointer);
  renderer.domElement.addEventListener('pointercancel', endPointer);
  renderer.domElement.addEventListener('pointerleave', () => {
    activeSculptPointers.clear();
  });

  if (typeof window !== 'undefined') {
    window.__NOISYSHAPE_DEBUG = {
      ...window.__NOISYSHAPE_DEBUG,
      hitTestViewport,
      getActiveSculptTool: () => activeTool?.id ?? null
    };
  }
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
