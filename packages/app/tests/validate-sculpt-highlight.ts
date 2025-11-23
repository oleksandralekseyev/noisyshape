import {
  BoxGeometry,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer
} from 'three';
import { createSculptHighlight } from '../src/viewer/sculpting.ts';
import { resolveSculptIntent } from '../src/viewer/inputModes.ts';

const POINTER_RADIUS_PX = 40;

function expect(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function getHighlightMesh(scene: Scene): Mesh {
  const child = scene.children.find((candidate) => (candidate as Mesh).name === 'sculpt-highlight');
  expect(child, 'Highlight mesh should be added to the scene');
  return child as Mesh;
}

function computeExpectedRadius({
  hitPoint,
  camera,
  renderer,
  radiusPx
}: {
  hitPoint: Vector3;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  radiusPx: number;
}): number {
  const distance = hitPoint.distanceTo(camera.position);
  const fovRadians = (camera.fov * Math.PI) / 180;
  const viewportHeight = renderer.domElement.clientHeight || 1;
  const worldHeightAtDistance = 2 * distance * Math.tan(fovRadians / 2);
  const worldPerPixel = worldHeightAtDistance / viewportHeight;
  return worldPerPixel * radiusPx;
}

async function run(): Promise<void> {
  const intentCases = [
    {
      description: 'mouse sculpt with hit',
      expected: 'sculpt',
      params: {
        pointerType: 'mouse',
        button: 0,
        altKey: false,
        hasHit: true,
        sculptToolActive: true,
        doublePress: false
      }
    },
    {
      description: 'alt key forces navigation',
      expected: 'navigate',
      params: {
        pointerType: 'mouse',
        button: 0,
        altKey: true,
        hasHit: true,
        sculptToolActive: true,
        doublePress: false
      }
    },
    {
      description: 'middle or right click navigates',
      expected: 'navigate',
      params: {
        pointerType: 'mouse',
        button: 2,
        altKey: false,
        hasHit: true,
        sculptToolActive: true,
        doublePress: false
      }
    },
    {
      description: 'no hit falls back to navigation',
      expected: 'navigate',
      params: {
        pointerType: 'mouse',
        button: 0,
        altKey: false,
        hasHit: false,
        sculptToolActive: true,
        doublePress: false
      }
    },
    {
      description: 'inactive sculpt tool navigates',
      expected: 'navigate',
      params: {
        pointerType: 'mouse',
        button: 0,
        altKey: false,
        hasHit: true,
        sculptToolActive: false,
        doublePress: false
      }
    },
    {
      description: 'single-touch sculpt',
      expected: 'sculpt',
      params: {
        pointerType: 'touch',
        button: 0,
        altKey: false,
        hasHit: true,
        sculptToolActive: true,
        doublePress: false
      }
    },
    {
      description: 'double press on desktop navigates',
      expected: 'navigate',
      params: {
        pointerType: 'mouse',
        button: 0,
        altKey: false,
        hasHit: true,
        sculptToolActive: true,
        doublePress: true
      }
    }
  ] as const;

  intentCases.forEach((testCase) => {
    const result = resolveSculptIntent(testCase.params);
    expect(
      result === testCase.expected,
      `resolveSculptIntent should return "${testCase.expected}" for ${testCase.description}`
    );
  });

  const scene = new Scene();
  const controller = createSculptHighlight(scene);
  const highlightMesh = getHighlightMesh(scene);
  expect(!highlightMesh.visible, 'Highlight starts hidden');

  const mesh = new Mesh(new BoxGeometry(1, 1, 1));
  mesh.position.set(1, 2, 3);
  mesh.updateMatrixWorld(true);
  scene.add(mesh);

  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 5);

  const renderer = { domElement: { clientHeight: 100 } } as unknown as WebGLRenderer;
  const hitPoint = new Vector3(1, 2, 3);

  controller.update({
    hit: { object: mesh, point: hitPoint } as any,
    camera,
    renderer,
    pointerType: 'mouse'
  });

  const material = highlightMesh.material as ShaderMaterial;
  expect(highlightMesh.visible, 'Highlight becomes visible after update');
  expect(highlightMesh.geometry === mesh.geometry, 'Highlight reuses the target geometry');
  expect(
    highlightMesh.matrix.equals(mesh.matrixWorld),
    'Highlight copies the target world transform'
  );
  expect(
    material.uniforms.uCenter.value.equals(hitPoint),
    'Highlight center follows the latest hit point'
  );

  const expectedRadius = computeExpectedRadius({
    hitPoint,
    camera,
    renderer,
    radiusPx: POINTER_RADIUS_PX
  });
  const radiusDiff = Math.abs(material.uniforms.uRadius.value - expectedRadius);
  expect(radiusDiff < 1e-4, 'World radius reflects pointer size and camera distance');

  controller.clear();
  expect(!highlightMesh.visible, 'Highlight hides after clear');
  expect(material.uniforms.uRadius.value === 0, 'Radius resets after clear');

  console.log('validate-sculpt-highlight: ok');
}

run().catch((error) => {
  console.error('validate-sculpt-highlight failed:');
  console.error(error);
  throw error;
});
