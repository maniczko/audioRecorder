const DB_NAME = "voicelog-audio";
const STORE_NAME = "recordings";
const DB_VERSION = 1;

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function openDatabase() {
  if (!hasIndexedDb()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
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

async function withStore(mode, callback) {
  const db = await openDatabase();
  if (!db) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve(true);

    callback(store, resolve, reject);
  });
}

export async function saveAudioBlob(recordingId, blob) {
  if (!recordingId || !blob) {
    return;
  }

  await withStore("readwrite", (store) => {
    store.put(blob, recordingId);
  });
}

export async function getAudioBlob(recordingId) {
  if (!recordingId) {
    return null;
  }

  const db = await openDatabase();
  if (!db) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(recordingId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function deleteAudioBlob(recordingId) {
  if (!recordingId) {
    return;
  }

  await withStore("readwrite", (store) => {
    store.delete(recordingId);
  });
}
