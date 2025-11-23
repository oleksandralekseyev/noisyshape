import {
  AmbientLight,
  Box3,
  HemisphereLight,
  Scene,
  Vector3,
  type Object3D,
  type PerspectiveCamera
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function setupLights(scene: Scene): void {
  const ambient = new AmbientLight('#9da7ad', 0.9);
  const hemisphere = new HemisphereLight('#dce7ff', '#1f1f23', 1.1);
  scene.add(ambient, hemisphere);
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
