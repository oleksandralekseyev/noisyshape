import assert from 'node:assert/strict';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Vector3
} from 'three';
import {
  computeHighlightRadius,
  createSculptHighlight,
  updateSculptHighlightMesh
} from '../src/sculptHighlight.ts';

type TestCase = { name: string; run: () => void };

function createPlaneMesh(): Mesh {
  const geometry = new BufferGeometry();
  const vertices = new Float32Array([
    -1, 0, -1,
    1, 0, -1,
    1, 0, 1,
    -1, 0, 1
  ]);
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return new Mesh(geometry, new MeshBasicMaterial());
}

const tests: TestCase[] = [
  {
    name: 'computeHighlightRadius scales with slider percentage',
    run: () => {
      const mesh = createPlaneMesh();
      const full = computeHighlightRadius(mesh, 100);
      const half = computeHighlightRadius(mesh, 50);
      assert.ok(full > 0, 'full radius should be positive');
      assert.ok(Math.abs(full - half * 2) < 1e-6, 'radius should scale linearly');
    }
  },
  {
    name: 'computeHighlightRadius respects world scale',
    run: () => {
      const baseMesh = createPlaneMesh();
      const scaledMesh = createPlaneMesh();
      scaledMesh.scale.set(2, 2, 2);
      const baseRadius = computeHighlightRadius(baseMesh, 100);
      const scaledRadius = computeHighlightRadius(scaledMesh, 100);
      assert.ok(Math.abs(scaledRadius - baseRadius * 2) < 1e-6, 'world scale should influence radius');
    }
  },
  {
    name: 'updateSculptHighlightMesh populates triangles within radius',
    run: () => {
      const mesh = createPlaneMesh();
      const highlight = createSculptHighlight();
      const result = updateSculptHighlightMesh(highlight, { mesh, point: new Vector3(0, 0, 0) }, 100);
      assert.equal(result, true, 'highlight should update when within radius');
      const attribute = highlight.geometry.getAttribute('position') as Float32BufferAttribute;
      assert.equal(attribute.count, 6, 'two triangles should be highlighted');
    }
  },
  {
    name: 'updateSculptHighlightMesh hides highlight when no triangles match',
    run: () => {
      const mesh = createPlaneMesh();
      const highlight = createSculptHighlight();
      const result = updateSculptHighlightMesh(highlight, { mesh, point: new Vector3(10, 0, 10) }, 10);
      assert.equal(result, false, 'highlight should not show without nearby triangles');
      assert.equal(highlight.visible, false, 'highlight mesh should be hidden');
    }
  }
];

for (const test of tests) {
  test.run();
  console.log(`✅ ${test.name}`);
}
