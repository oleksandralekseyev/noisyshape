import { MeshStandardMaterial } from 'three';

export function createSolidMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0xcfd8dc,
    metalness: 0.1,
    roughness: 0.8
  });
}
