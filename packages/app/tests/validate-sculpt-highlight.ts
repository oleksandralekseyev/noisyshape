import { BufferGeometry, Float32BufferAttribute, Mesh, Vector3 } from 'three';
import { computeSculptHighlightTriangles } from '../src/viewer/sculpting.ts';

function expect(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function buildSquareMesh(): Mesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [
        -1, 0, -1,
        1, 0, -1,
        -1, 0, 1,
        1, 0, 1
      ],
      3
    )
  );
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  const mesh = new Mesh(geometry);
  mesh.updateMatrixWorld(true);
  return mesh;
}

function toTriangles(array: Float32Array): Vector3[][] {
  const triangles: Vector3[][] = [];
  for (let i = 0; i < array.length; i += 9) {
    triangles.push([
      new Vector3(array[i], array[i + 1], array[i + 2]),
      new Vector3(array[i + 3], array[i + 4], array[i + 5]),
      new Vector3(array[i + 6], array[i + 7], array[i + 8])
    ]);
  }
  return triangles;
}

async function run(): Promise<void> {
  const mesh = buildSquareMesh();

  // Focus on a corner; only the triangle sharing that vertex should be highlighted.
  const cornerHit = new Vector3(-1, 0, -1);
  const cornerRadius = 0.75;
  const cornerSelection = computeSculptHighlightTriangles({
    mesh,
    hitPoint: cornerHit,
    worldRadius: cornerRadius
  });
  expect(cornerSelection, 'Expected highlight data for corner hit');
  const cornerTriangles = toTriangles(cornerSelection!);
  expect(cornerTriangles.length === 1, 'Only one triangle should be highlighted near the corner');
  expect(
    cornerTriangles[0].some((vertex) => vertex.equals(cornerHit)),
    'Highlighted triangle should include the hit vertex'
  );

  // Focus on the center with a larger radius; both triangles should be highlighted.
  const centerHit = new Vector3(0, 0, 0);
  const centerRadius = Math.sqrt(2);
  const centerSelection = computeSculptHighlightTriangles({
    mesh,
    hitPoint: centerHit,
    worldRadius: centerRadius
  });
  expect(centerSelection, 'Expected highlight data for center hit');
  const centerTriangles = toTriangles(centerSelection!);
  expect(centerTriangles.length === 2, 'Both triangles should be highlighted near the center');

  // Far away hit should produce no highlight.
  const farHit = new Vector3(10, 0, 10);
  const farSelection = computeSculptHighlightTriangles({
    mesh,
    hitPoint: farHit,
    worldRadius: 0.5
  });
  expect(farSelection !== null, 'Far selection should return Float32Array, not null');
  expect(farSelection!.length === 0, 'No triangles should be highlighted when hit is outside radius');

  console.log('validate-sculpt-highlight: ok');
}

run().catch((error) => {
  console.error('validate-sculpt-highlight failed:');
  console.error(error);
  throw error;
});
