import type { ToolDescriptor } from './types';

type ToolsPanelHandlers = {
  onSelectionChange?: (tool: ToolDescriptor | null) => void;
};

type ToolsPanel = {
  element: HTMLElement;
  setVisible: (visible: boolean) => void;
  setActiveTool: (toolId: string | null) => void;
};

export function createToolsPanel(
  tools: ToolDescriptor[],
  handlers: ToolsPanelHandlers = {}
): ToolsPanel {
  const { onSelectionChange } = handlers;
  const panel = document.createElement('div');
  panel.className = 'tools-panel tools-hidden';

  const list = document.createElement('div');
  list.className = 'tools-list';

  const label = document.createElement('div');
  label.className = 'tools-label';
  label.textContent = 'Sculpt mode';

  panel.append(list, label);

  const toolMap = new Map(tools.map((tool) => [tool.id, tool]));
  const buttons = new Map<string, HTMLButtonElement>();
  let activeToolId: string | null = null;
  let defaultLabel = 'Sculpt mode';

  const setActiveToolInternal = (toolId: string | null, silent = false) => {
    activeToolId = toolId;
    buttons.forEach((btn, id) => {
      btn.classList.toggle('is-active', id === toolId);
    });
    const descriptor = toolId ? toolMap.get(toolId) ?? null : null;
    defaultLabel = descriptor?.label ?? 'Sculpt mode';
    label.textContent = defaultLabel;
    if (!silent) {
      onSelectionChange?.(descriptor);
    }
  };

  tools.forEach((tool) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tools-button';
    button.dataset.tool = tool.id;
    button.setAttribute('aria-label', tool.label);
    const img = document.createElement('img');
    img.src = tool.icon;
    img.alt = tool.label;
    button.appendChild(img);
    const showToolLabel = () => {
      label.textContent = tool.label;
    };
    const resetLabel = () => {
      label.textContent = defaultLabel;
    };
    button.addEventListener('mouseenter', showToolLabel);
    button.addEventListener('mouseleave', resetLabel);
    button.addEventListener('focus', showToolLabel);
    button.addEventListener('blur', resetLabel);
    button.addEventListener('click', () => {
      setActiveToolInternal(tool.id);
    });
    buttons.set(tool.id, button);
    list.appendChild(button);
  });

  return {
    element: panel,
    setVisible: (visible: boolean) => {
      panel.classList.toggle('tools-hidden', !visible);
    },
    setActiveTool: (toolId: string | null) => {
      setActiveToolInternal(toolId, true);
    }
  };
}

export function createToolsToggle(onToggle: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tools-toggle';
  button.setAttribute('aria-label', 'Show sculpt tools');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', onToggle);
  const icon = document.createElement('img');
  icon.src = '';
  icon.alt = 'Sculpt';
  button.appendChild(icon);
  return button;
}
