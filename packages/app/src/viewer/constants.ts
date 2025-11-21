export const SUPPORTED_EXTENSIONS = ['.glb', '.gltf', '.obj', '.stl', '.ply'] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];
