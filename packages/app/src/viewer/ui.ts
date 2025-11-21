export function createOverlay(text: string): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'drop-message';
  overlay.textContent = text;
  return overlay;
}

export function hideOverlay(el: HTMLElement): void {
  el.classList.add('hidden');
}

export function createStatus(text: string): HTMLDivElement {
  const status = document.createElement('div');
  status.className = 'status';
  status.textContent = text;
  if (!text) {
    status.classList.add('is-empty');
  }
  return status;
}

export function statusMessage(el: HTMLElement, message: string, isError = false): void {
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.toggle('is-empty', message.length === 0);
}

export function createFilePicker(onFile: (file: File) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = [
    '.glb',
    '.gltf',
    '.obj',
    '.stl',
    '.ply',
    'model/gltf-binary',
    'model/gltf+json',
    'model/stl',
    'model/obj',
    'application/sla',
    'application/vnd.ms-pki.stl',
    'application/octet-stream'
  ].join(',');
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) {
      onFile(file);
    }
    input.value = '';
  });
  return input;
}
