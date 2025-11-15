const STORAGE_KEY = 'noisyshape:last-model';

type StoredModel = {
  name: string;
  dataUrl: string;
};

export async function persistModel(file: File): Promise<void> {
  try {
    const dataUrl = await fileToDataUrl(file);
    const payload: StoredModel = { name: file.name, dataUrl };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist model', error);
  }
}

export function getPersistedModel(): StoredModel | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as StoredModel;
  } catch (error) {
    console.warn('Failed to read persisted model', error);
    return null;
  }
}

export function clearPersistedModel(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear persisted model', error);
  }
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
