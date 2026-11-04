import { isAndroid, native, nativeFileUrl } from "./platform";
const DB = "frasi.audio.v1";
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("recordings");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveRecording(key: string, blob: Blob) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("recordings", "readwrite");
      tx.objectStore("recordings").put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function getRecording(key: string): Promise<Blob | undefined> {
  if (isAndroid) {
    const result = await native.getRecording({ key });
    if (!result.exists || !result.path) return;
    const response = await fetch(nativeFileUrl(result.path));
    if (!response.ok) throw new Error("Recording unavailable");
    return response.blob();
  }
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("recordings", "readonly")
        .objectStore("recordings")
        .get(key);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
export async function clearRecordings() {
  if (isAndroid) return native.clearRecordings();
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("recordings", "readwrite");
      tx.objectStore("recordings").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
