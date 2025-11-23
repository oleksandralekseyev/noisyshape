export type SculptPointerIntent = 'sculpt' | 'navigate';

export interface SculptPointerIntentParams {
  pointerType: string;
  button: number;
  altKey: boolean;
  hasHit: boolean;
  sculptToolActive: boolean;
  doublePress: boolean;
}

export function resolveSculptIntent({
  pointerType,
  button,
  altKey,
  hasHit,
  sculptToolActive,
  doublePress
}: SculptPointerIntentParams): SculptPointerIntent {
  if (!sculptToolActive) {
    return 'navigate';
  }

  if (pointerType !== 'touch' && doublePress) {
    return 'navigate';
  }

  if (!hasHit) {
    return 'navigate';
  }

  if (altKey) {
    return 'navigate';
  }

  if (button === 1 || button === 2) {
    return 'navigate';
  }

  return 'sculpt';
}
