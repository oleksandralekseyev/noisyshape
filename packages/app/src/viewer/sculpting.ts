import type { Intersection, Object3D, PerspectiveCamera, Scene } from 'three';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Matrix4,
  Mesh,
  ShaderMaterial,
  Vector3,
  WebGLRenderer
} from 'three';

const TOUCH_RADIUS_PX = 48;
const POINTER_RADIUS_PX = 40;
const PEN_RADIUS_PX = 24;
const SMOOTHING_STRENGTH = 0.1;
const SMOOTHING_MU_SCALE = -0.6;
const HIGHLIGHT_COLOR = new Color('#29b6f6');
const HIGHLIGHT_EDGE_FEATHER = 0.3;
const HIGHLIGHT_OPACITY = 0.6;

export interface SculptHighlightController {
  update(params: {
    hit: Intersection<Object3D>;
    camera: PerspectiveCamera;
    renderer: WebGLRenderer;
    pointerType: string;
  }): void;
  clear(): void;
}

export function smoothAtIntersection({
  hit,
  camera,
  renderer,
  pointerType
}: {
  hit: Intersection<Object3D>;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  pointerType: string;
}): boolean {
  const mesh = findMesh(hit.object);
  if (!mesh) {
    return false;
  }
  const geometry = mesh.geometry as BufferGeometry;
  const positionAttr = geometry.getAttribute('position');
  if (!positionAttr || typeof positionAttr.setXYZ !== 'function') {
    return false;
  }

  const radiusPx = getPointerRadius(pointerType);
  const worldRadius = getWorldRadius(radiusPx, camera, renderer, hit.point);
  if (worldRadius <= 0) {
    return false;
  }

  const matrixWorld = mesh.matrixWorld;
  const inverse = new Matrix4().copy(matrixWorld).invert();
  const centroid = new Vector3();
  const selected: Array<{ index: number; world: Vector3; local: Vector3 }> = [];
  const vertex = new Vector3();
  const worldVertex = new Vector3();

  for (let i = 0; i < positionAttr.count; i += 1) {
    vertex.fromBufferAttribute(positionAttr, i);
    worldVertex.copy(vertex).applyMatrix4(matrixWorld);
    if (worldVertex.distanceTo(hit.point) <= worldRadius) {
      centroid.add(worldVertex);
      selected.push({ index: i, world: worldVertex.clone(), local: vertex.clone() });
    }
  }

  if (selected.length === 0) {
    return false;
  }

  centroid.divideScalar(selected.length);
  const lambda = SMOOTHING_STRENGTH;
  const mu = lambda * SMOOTHING_MU_SCALE;
  const updated = new Vector3();
  selected.forEach(({ index, world }) => {
    updated.copy(world).lerp(centroid, lambda);
    updated.lerp(centroid, mu);
    updated.applyMatrix4(inverse);
    positionAttr.setXYZ(index, updated.x, updated.y, updated.z);
  });

  positionAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  return true;
}

function getPointerRadius(pointerType: string): number {
  if (pointerType === 'touch') {
    return TOUCH_RADIUS_PX;
  }
  if (pointerType === 'pen') {
    return PEN_RADIUS_PX;
  }
  return POINTER_RADIUS_PX;
}

function getWorldRadius(
  radiusPx: number,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  point: Vector3
): number {
  const distance = point.distanceTo(camera.position);
  const fovRadians = (camera.fov * Math.PI) / 180;
  const pixelRatio =
    typeof renderer.getPixelRatio === 'function'
      ? renderer.getPixelRatio()
      : typeof window !== 'undefined'
        ? window.devicePixelRatio || 1
        : 1;
  const viewportHeight = (renderer.domElement.clientHeight || 1) * pixelRatio;
  const worldHeightAtDistance = 2 * distance * Math.tan(fovRadians / 2);
  const worldPerPixel = worldHeightAtDistance / viewportHeight;
  return worldPerPixel * radiusPx;
}

function findMesh(object: Object3D): Mesh | null {
  let current: Object3D | null = object;
  while (current) {
    const maybeMesh = current as Mesh;
    if (maybeMesh.isMesh) {
      return maybeMesh;
    }
    current = current.parent;
  }
  return null;
}

function createHighlightMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uCenter: { value: new Vector3() },
      uRadius: { value: 0 },
      uColor: { value: HIGHLIGHT_COLOR.clone() },
      uEdgeFeather: { value: HIGHLIGHT_EDGE_FEATHER },
      uOpacity: { value: HIGHLIGHT_OPACITY }
    },
    vertexShader: `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uCenter;
      uniform float uRadius;
      uniform vec3 uColor;
      uniform float uEdgeFeather;
      uniform float uOpacity;
      varying vec3 vWorldPosition;

      void main() {
        float dist = length(vWorldPosition - uCenter);
        float falloff = 1.0 - smoothstep(uRadius * (1.0 - uEdgeFeather), uRadius, dist);
        if (falloff <= 0.001) discard;
        gl_FragColor = vec4(uColor * falloff, falloff * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    blending: AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    toneMapped: false
  });
}

export function createSculptHighlight(scene: Scene): SculptHighlightController {
  const material = createHighlightMaterial();
  const highlightMesh = new Mesh(new BufferGeometry(), material);
  highlightMesh.name = 'sculpt-highlight';
  highlightMesh.visible = false;
  highlightMesh.frustumCulled = false;
  highlightMesh.matrixAutoUpdate = false;
  highlightMesh.renderOrder = 999;
  scene.add(highlightMesh);

  const update: SculptHighlightController['update'] = ({ hit, camera, renderer, pointerType }) => {
    const mesh = findMesh(hit.object);
    if (!mesh) {
      clear();
      return;
    }
    const radiusPx = getPointerRadius(pointerType);
    const worldRadius = getWorldRadius(radiusPx, camera, renderer, hit.point);
    if (worldRadius <= 0) {
      clear();
      return;
    }
    mesh.updateMatrixWorld(true);
    highlightMesh.geometry = mesh.geometry;
    highlightMesh.matrix.copy(mesh.matrixWorld);
    highlightMesh.matrixWorld.copy(mesh.matrixWorld);
    highlightMesh.matrixWorldNeedsUpdate = false;
    highlightMesh.layers.mask = mesh.layers.mask;

    const uniforms = material.uniforms;
    uniforms.uCenter.value.copy(hit.point);
    uniforms.uRadius.value = worldRadius;

    highlightMesh.visible = true;
  };

  const clear = () => {
    material.uniforms.uRadius.value = 0;
    highlightMesh.visible = false;
  };

  return { update, clear };
}
