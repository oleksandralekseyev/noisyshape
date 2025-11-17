export function setupDragAndDrop(
  container: HTMLElement,
  onFile: (file: File) => void
): void {
  const dropSurface = document.createElement('div');
  dropSurface.className = 'drop-surface';
  container.appendChild(dropSurface);

  const toggleSurface = (active: boolean) => {
    dropSurface.classList.toggle('dragging', active);
    dropSurface.style.pointerEvents = active ? 'auto' : 'none';
  };

  toggleSurface(false);

  const preventDefaults = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const hasFiles = (event: DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files');

  let dragDepth = 0;

  const handleDragEnter = (event: DragEvent) => {
    if (!hasFiles(event)) {
      return;
    }
    preventDefaults(event);
    dragDepth += 1;
    toggleSurface(true);
  };

  const handleDragLeave = (event: DragEvent) => {
    if (!hasFiles(event)) {
      return;
    }
    preventDefaults(event);
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      toggleSurface(false);
    }
  };

  const handleDrop = (event: DragEvent) => {
    if (!hasFiles(event)) {
      return;
    }
    preventDefaults(event);
    dragDepth = 0;
    toggleSurface(false);
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }
    onFile(files[0]);
  };

  container.addEventListener('dragenter', handleDragEnter);
  container.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) {
      return;
    }
    preventDefaults(event);
  });
  container.addEventListener('dragleave', handleDragLeave);
  container.addEventListener('drop', handleDrop);

  window.addEventListener('dragover', preventDefaults);
  window.addEventListener('drop', preventDefaults);
}
