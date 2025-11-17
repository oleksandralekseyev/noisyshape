import { AmbientLight, Box3, DirectionalLight, Scene, Vector3, type Object3D, type PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function setupLights(scene: Scene): void {
  const ambient = new AmbientLight('#7f8c8d', 0.8);
  const key = new DirectionalLight('#ffffff', 1.2);
  key.position.set(5, 10, 7);
  const fill = new DirectionalLight('#6bb3ff', 0.6);
  fill.position.set(-6, 5, -4);
  scene.add(ambient, key, fill);
}

export function fitCameraToObject(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  object: Object3D
): void {
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
