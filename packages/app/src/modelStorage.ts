const TAB_STORAGE_PREFIX = 'noisyshape:last-model:tab:';
const TAB_ID_SESSION_KEY = 'noisyshape:tab-id';

export type StoredModel = {
  name: string;
  dataUrl: string;
};

type PersistedPayload = StoredModel[];

let persistQueue: Promise<void> = Promise.resolve();

export function persistModel(file: File): Promise<void> {
  persistQueue = persistQueue.then(
    () => persistModelInternal(file),
    () => persistModelInternal(file)
  );
  return persistQueue;
}

export function getPersistedModels(): StoredModel[] {
  const tabKey = getTabStorageKey();
  if (!tabKey) {
    return [];
  }
  return readModelsForKey(tabKey);
}

export function clearPersistedModels(): void {
  const tabKey = getTabStorageKey();
  if (!tabKey) {
    return;
  }
  try {
    localStorage.removeItem(tabKey);
  } catch (error) {
    console.warn('Failed to clear persisted models', error);
  }
}

async function persistModelInternal(file: File): Promise<void> {
  try {
    const dataUrl = await fileToDataUrl(file);
    const payload: StoredModel = { name: file.name, dataUrl };
    const models = getPersistedModels();
    models.push(payload);
    writeModels(models);
  } catch (error) {
    console.warn('Failed to persist model', error);
  }
}

function readModelsForKey(key: string): StoredModel[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    return parseModels(raw);
  } catch (error) {
    console.warn(`Failed to parse persisted models for ${key}`, error);
    return [];
  }
}

function writeModels(models: PersistedPayload): void {
  const tabKey = getTabStorageKey();
  if (!tabKey) {
    return;
  }
  const serialized = models.length > 0 ? JSON.stringify(models) : null;
  try {
    if (serialized === null) {
      localStorage.removeItem(tabKey);
    } else {
      localStorage.setItem(tabKey, serialized);
    }
  } catch (error) {
    console.warn('Failed to write persisted models', error);
  }
}

function parseModels(raw: string): StoredModel[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return sanitizeModels(parsed);
    }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).models)) {
      return sanitizeModels((parsed as any).models);
    }
    if (parsed && typeof parsed === 'object' && 'name' in parsed && 'dataUrl' in parsed) {
      return sanitizeModels([parsed]);
    }
  } catch (error) {
    console.warn('Unable to parse persisted models', error);
  }
  return [];
}

function sanitizeModels(models: unknown[]): StoredModel[] {
  return models
    .filter((value): value is StoredModel => {
      return (
        !!value &&
        typeof value === 'object' &&
        'name' in value &&
        'dataUrl' in value &&
        typeof (value as any).name === 'string' &&
        typeof (value as any).dataUrl === 'string'
      );
    })
    .map((value) => ({ name: value.name, dataUrl: value.dataUrl }));
}

function getTabStorageKey(): string | null {
  const tabId = getTabId();
  return tabId ? `${TAB_STORAGE_PREFIX}${tabId}` : null;
}

let cachedTabId: string | null | undefined;

function getTabId(): string | null {
  if (cachedTabId !== undefined) {
    return cachedTabId;
  }
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    cachedTabId = null;
    return cachedTabId;
  }
  try {
    let id = window.sessionStorage.getItem(TAB_ID_SESSION_KEY);
    if (!id) {
      id = createTabId();
      window.sessionStorage.setItem(TAB_ID_SESSION_KEY, id);
    }
    cachedTabId = id;
    return id;
  } catch (error) {
    console.warn('Failed to access sessionStorage for tab id', error);
    cachedTabId = null;
    return cachedTabId;
  }
}

function createTabId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (event) => {
      reject((event.target && (event.target as FileReader).error) || reader.error);
    };
    reader.readAsDataURL(file);
  });
}
