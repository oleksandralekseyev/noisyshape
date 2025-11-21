import { SUPPORTED_EXTENSIONS } from './constants';

export function supportsTapImport(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const nav = window.navigator;
  const coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
  return (
    coarse ||
    'ontouchstart' in window ||
    (nav && typeof nav.maxTouchPoints === 'number' && nav.maxTouchPoints > 0)
  );
}

export function isSupported(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function createModelId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `model-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}
