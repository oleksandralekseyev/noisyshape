import { Mesh, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { createSolidMaterial } from './solidMaterial';

export type ModelLoader = {
  extensions: string[];
  loadFromFile: (file: File) => Promise<Object3D>;
  loadFromDataUrl: (name: string, dataUrl: string) => Promise<Object3D>;
};

export function buildModelLoaders({
  gltfLoader,
  objLoader,
  stlLoader,
  plyLoader
}: {
  gltfLoader: GLTFLoader;
  objLoader: OBJLoader;
  stlLoader: STLLoader;
  plyLoader: PLYLoader;
}): ModelLoader[] {
  return [
    createGltfModelLoader(gltfLoader),
    createObjModelLoader(objLoader),
    createStlModelLoader(stlLoader),
    createPlyModelLoader(plyLoader)
  ];
}

export function findModelLoader(loaders: ModelLoader[], fileName: string): ModelLoader | undefined {
  const lower = fileName.toLowerCase();
  return loaders.find((loader) => loader.extensions.some((ext) => lower.endsWith(ext)));
}

function createGltfModelLoader(loader: GLTFLoader): ModelLoader {
  const loadScene = (url: string) => loader.loadAsync(url).then((gltf) => gltf.scene);
  return {
    extensions: ['.glb', '.gltf'],
    loadFromFile: (file) => withObjectUrl(file, loadScene),
    loadFromDataUrl: (_, dataUrl) => withDataUrl(dataUrl, loadScene)
  };
}

function createObjModelLoader(loader: OBJLoader): ModelLoader {
  const loadScene = (url: string) => loader.loadAsync(url);
  return {
    extensions: ['.obj'],
    loadFromFile: (file) => withObjectUrl(file, loadScene),
    loadFromDataUrl: (_, dataUrl) => withDataUrl(dataUrl, loadScene)
  };
}

function createStlModelLoader(loader: STLLoader): ModelLoader {
  const loadMesh = async (url: string) => {
    const geometry = await loader.loadAsync(url);
    geometry.computeVertexNormals();
    return new Mesh(geometry, createSolidMaterial());
  };
  return {
    extensions: ['.stl'],
    loadFromFile: (file) => withObjectUrl(file, loadMesh),
    loadFromDataUrl: (_, dataUrl) => withDataUrl(dataUrl, loadMesh)
  };
}

function createPlyModelLoader(loader: PLYLoader): ModelLoader {
  const loadMesh = async (url: string) => {
    const geometry = await loader.loadAsync(url);
    geometry.computeVertexNormals?.();
    return new Mesh(geometry, createSolidMaterial());
  };
  return {
    extensions: ['.ply'],
    loadFromFile: (file) => withObjectUrl(file, loadMesh),
    loadFromDataUrl: (_, dataUrl) => withDataUrl(dataUrl, loadMesh)
  };
}

async function withObjectUrl<T>(file: File, load: (url: string) => Promise<T>): Promise<T> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await load(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function withDataUrl<T>(dataUrl: string, load: (url: string) => Promise<T>): Promise<T> {
  if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http')) {
    return load(dataUrl);
  }
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await load(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
