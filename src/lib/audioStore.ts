const DB_NAME = 'voicelog-audio';
const STORE_NAME = 'recordings';
const DB_VERSION = 1;
const MAX_BLOB_BYTES = 500 * 1024 * 1024;
const QUOTA_WARN_BYTES = 10 * 1024 * 1024;
const STORAGE_WARN_RATIO = 0.8;

interface AudioStorageEstimate {
  usageBytes: number;
  quotaBytes: number;
  freeBytes: number;
  usageRatio: number;
  isNearQuota: boolean;
}

async function getStorageEstimate(): Promise<AudioStorageEstimate | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return null;
  }

  const { usage, quota } = await navigator.storage.estimate();
  const usageBytes = Number(usage || 0);
  const quotaBytes = Number(quota || 0);
  const freeBytes = Math.max(0, quotaBytes - usageBytes);
  const usageRatio = quotaBytes > 0 ? usageBytes / quotaBytes : 0;

  return {
    usageBytes,
    quotaBytes,
    freeBytes,
    usageRatio,
    isNearQuota: usageRatio >= STORAGE_WARN_RATIO,
  };
}

async function checkStorageQuota(blobSize: number) {
  const estimate = await getStorageEstimate();

  if (blobSize > MAX_BLOB_BYTES) {
    throw new Error(
      `Plik audio (${Math.round(blobSize / 1024 / 1024)} MB) przekracza limit ${MAX_BLOB_BYTES / 1024 / 1024} MB.`
    );
  }

  if (!estimate) {
    return;
  }

  if (estimate.freeBytes < QUOTA_WARN_BYTES) {
    throw new Error(
      `Za malo miejsca w przegladarce (zostalo ${Math.round(estimate.freeBytes / 1024 / 1024)} MB). Zwolnij miejsce i sprobuj ponownie.`
    );
  }
}

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function openDatabase() {
  if (!hasIndexedDb()) {
    return Promise.resolve<IDBDatabase | null>(null);
  }

  return new Promise<IDBDatabase | null>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (
    store: IDBObjectStore,
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void
  ) => void
) {
  const db = await openDatabase();
  if (!db) {
    return null;
  }

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve(true as T);

    callback(store, resolve, reject);
  });
}

export async function saveAudioBlob(recordingId: string, blob: Blob) {
  if (!recordingId || !blob) {
    return;
  }

  await checkStorageQuota(blob.size || 0);

  await withStore('readwrite', (store) => {
    store.put(blob, recordingId);
  });
}

export async function getAudioBlob(recordingId: string) {
  if (!recordingId) {
    return null;
  }

  const db = await openDatabase();
  if (!db) {
    return null;
  }

  return new Promise<Blob | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(recordingId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function deleteAudioBlob(recordingId: string) {
  if (!recordingId) {
    return;
  }

  await withStore('readwrite', (store) => {
    store.delete(recordingId);
  });
}

export async function listStoredAudioSizes() {
  const db = await openDatabase();
  if (!db) {
    return [];
  }

  return new Promise<Array<{ recordingId: string; sizeBytes: number; mimeType: string }>>(
    (resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const items: Array<{ recordingId: string; sizeBytes: number; mimeType: string }> = [];
      const request = store.openCursor();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(items);
          return;
        }

        const value = cursor.value;
        items.push({
          recordingId: String(cursor.key || ''),
          sizeBytes: Number(value?.size || 0),
          mimeType: String(value?.type || ''),
        });
        cursor.continue();
      };
    }
  );
}

export async function deleteRecordingBlob(recordingId: string) {
  return deleteAudioBlob(recordingId);
}

export async function listStoredSizes() {
  return listStoredAudioSizes();
}

export async function getAudioStorageEstimate() {
  return getStorageEstimate();
}
