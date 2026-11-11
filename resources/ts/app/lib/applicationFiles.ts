const _fileStore = new Map<string, any>();

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

function saveFile(appId: string, fileData: {
  resumeFileName?: string | null;
  resumeFileData?: string | null;
  supportingDocuments?: string[];
  supportingDocumentFiles?: any[];
}): void {
  _fileStore.set(appId, fileData);
  try {
    localStorage.setItem(`hris_file_${appId}`, JSON.stringify(fileData));
  } catch {
    // QuotaExceededError — in-memory store still works for this session
  }
}

function loadFile(appId: string): any | null {
  if (_fileStore.has(appId)) {
    return _fileStore.get(appId);
  }
  try {
    const raw = localStorage.getItem(`hris_file_${appId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    _fileStore.set(appId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function saveApplicationFiles(appId: string, fileData: {
  resumeFileName?: string | null;
  resumeFileData?: string | null;
  supportingDocuments?: string[];
  supportingDocumentFiles?: any[];
}): void {
  saveFile(appId, fileData);
}

export function loadApplicationFiles(appId: string): {
  resumeFileName?: string | null;
  resumeFileData?: string | null;
  supportingDocuments?: string[];
  supportingDocumentFiles?: any[];
} | null {
  return loadFile(appId);
}
