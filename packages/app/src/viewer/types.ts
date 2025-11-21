import type { Object3D } from 'three';

export type ModelEntry = {
  id: string;
  name: string;
  object: Object3D;
  visible: boolean;
  wireframe: boolean;
};

export type ToolDescriptor = { id: string; label: string; icon: string };
