import { SUPPORTED_EXTENSIONS } from './constants';
import type { ModelEntry } from './types';

type ModelPanelHandlers = {
  onVisibilityChange: (id: string, visible: boolean) => void;
  onWireframeChange: (id: string, wireframe: boolean) => void;
};

export type ModelPanelInstance = {
  element: HTMLElement;
  render: (models: ModelEntry[]) => void;
  setVisible: (visible: boolean) => void;
  setAction: (action: HTMLElement | null) => void;
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createModelPanel(handlers: ModelPanelHandlers): ModelPanelInstance {
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';

  const header = document.createElement('div');
  header.className = 'panel-header';
  header.textContent = 'Models';

  const list = document.createElement('div');
  list.className = 'model-list';

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'model-table-wrapper';

  const table = document.createElement('table');
  table.className = 'model-table';

  const tableBody = document.createElement('tbody');
  tableBody.className = 'model-table-body';

  table.appendChild(tableBody);
  tableWrapper.appendChild(table);

  const empty = document.createElement('div');
  empty.className = 'model-empty';
  empty.textContent = 'Drop models to populate the list.';

  list.append(tableWrapper, empty);
  tableWrapper.hidden = true;
  empty.hidden = false;
  const actionSlot = document.createElement('div');
  actionSlot.className = 'panel-action';
  actionSlot.hidden = true;

  sidebar.append(header, list, actionSlot);

  const render = (models: ModelEntry[]) => {
    tableBody.innerHTML = '';
    const hasModels = models.length > 0;
    tableWrapper.hidden = !hasModels;
    empty.hidden = hasModels;

    if (!hasModels) {
      return;
    }

    models.forEach((model) => {
      const row = document.createElement('tr');
      row.className = 'model-row';
      row.dataset.id = model.id;

      const nameCell = document.createElement('td');
      nameCell.className = 'model-cell model-cell-name';
      const name = document.createElement('span');
      name.className = 'model-name';
      const displayName = getDisplayName(model.name);
      name.textContent = displayName;
      name.title = displayName;
      nameCell.appendChild(name);

      const visibleCell = document.createElement('td');
      visibleCell.className = 'model-cell model-cell-toggle model-cell-visible';
      const visibleButton = createIconToggle({
        active: model.visible,
        label: `Toggle visibility for ${displayName}`,
        role: 'visible-toggle',
        variant: 'visible'
      });
      visibleButton.addEventListener('click', () =>
        handlers.onVisibilityChange(model.id, !model.visible)
      );
      visibleCell.appendChild(visibleButton);

      const wireCell = document.createElement('td');
      wireCell.className = 'model-cell model-cell-toggle model-cell-wireframe';
      const wireButton = createIconToggle({
        active: model.wireframe,
        label: `Toggle wireframe for ${displayName}`,
        role: 'wireframe-toggle',
        variant: 'wireframe'
      });
      wireButton.addEventListener('click', () =>
        handlers.onWireframeChange(model.id, !model.wireframe)
      );
      wireCell.appendChild(wireButton);

      row.append(nameCell, visibleCell, wireCell);
      tableBody.appendChild(row);
      applyMiddleEllipsis(name, displayName);
    });
  };

  return {
    element: sidebar,
    render,
    setVisible: (visible: boolean) => {
      sidebar.classList.toggle('sidebar-hidden', !visible);
    },
    setAction: (action: HTMLElement | null) => {
      actionSlot.innerHTML = '';
      if (action) {
        actionSlot.appendChild(action);
        actionSlot.hidden = false;
      } else {
        actionSlot.hidden = true;
      }
    }
  };
}

type IconToggleVariant = 'visible' | 'wireframe';

type IconToggleOptions = {
  active: boolean;
  label: string;
  role: string;
  variant: IconToggleVariant;
};

function createIconToggle(options: IconToggleOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  const classes = ['icon-toggle', `icon-toggle-${options.variant}`];
  if (options.active) {
    classes.push('is-active');
  }
  button.className = classes.join(' ');
  button.dataset.role = options.role;
  button.setAttribute('aria-pressed', options.active ? 'true' : 'false');
  button.setAttribute('aria-label', options.label);
  button.title = options.label;
  button.appendChild(createIcon(options.variant));
  return button;
}

function createIcon(variant: IconToggleVariant): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');

  if (variant === 'visible') {
    const outline = document.createElementNS(SVG_NS, 'path');
    outline.setAttribute(
      'd',
      'M2 12c2.8-4.4 6.4-6.6 10-6.6s7.2 2.2 10 6.6c-2.8 4.4-6.4 6.6-10 6.6S4.8 16.4 2 12Z'
    );
    const pupil = document.createElementNS(SVG_NS, 'circle');
    pupil.setAttribute('cx', '12');
    pupil.setAttribute('cy', '12');
    pupil.setAttribute('r', '3');
    svg.append(outline, pupil);
  } else {
    const square = document.createElementNS(SVG_NS, 'rect');
    square.setAttribute('x', '4');
    square.setAttribute('y', '4');
    square.setAttribute('width', '16');
    square.setAttribute('height', '16');
    const cross = document.createElementNS(SVG_NS, 'path');
    cross.setAttribute('d', 'M4 12h16M12 4v16M4 4l16 16M20 4 4 20');
    svg.append(square, cross);
  }

  return svg;
}

export function createPanelToggle(onToggle: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'panel-toggle is-disabled';
  button.disabled = true;
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Show model list');
  const icon = document.createElement('span');
  icon.className = 'panel-toggle-icon';
  for (let i = 0; i < 3; i += 1) {
    const bar = document.createElement('span');
    bar.className = 'panel-toggle-bar';
    icon.appendChild(bar);
  }
  button.appendChild(icon);
  button.addEventListener('click', () => {
    if (button.disabled) {
      return;
    }
    onToggle();
  });
  return button;
}

function getDisplayName(name: string): string {
  return stripModelExtension(name);
}

function stripModelExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0) {
    return name;
  }
  const extension = name.slice(dotIndex).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(extension as (typeof SUPPORTED_EXTENSIONS)[number])) {
    return name;
  }
  return name.slice(0, dotIndex);
}

function applyMiddleEllipsis(el: HTMLElement, fullText: string): void {
  el.textContent = fullText;
  if (!el.isConnected) {
    return;
  }
  const available = el.clientWidth;
  if (available === 0) {
    requestAnimationFrame(() => {
      if (el.isConnected) {
        applyMiddleEllipsis(el, fullText);
      }
    });
    return;
  }
  if (el.scrollWidth <= available) {
    return;
  }
  const ellipsis = '…';
  let prefixLen = Math.ceil(fullText.length / 2);
  let suffixLen = fullText.length - prefixLen;
  while (prefixLen > 1 && suffixLen > 1) {
    const truncated = `${fullText.slice(0, prefixLen)}${ellipsis}${fullText.slice(
      fullText.length - suffixLen
    )}`;
    el.textContent = truncated;
    if (el.scrollWidth <= el.clientWidth) {
      return;
    }
    prefixLen -= 1;
    suffixLen -= 1;
  }
  el.textContent = `${fullText.slice(0, 1)}${ellipsis}${fullText.slice(-1)}`;
}
