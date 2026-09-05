// CSV-Text je Datensatz: lokal in IndexedDB (schnell, groß), gespiegelt in den
// gemeinsamen Speicher (lib/store). Lesen holt den Serverstand, wenn er neuer
// ist als das, was dieses Gerät hat; Schreiben merkt den Upload vor.
import { markCsvText, hasPending, remoteStamp, localStamp, setStamps, fetchValue, unpackText, getStoreStatus } from './store';

const DB_NAME = 'scaper_csv';
const STORE   = 'files';
const DB_VER  = 1;

// Eine Verbindung pro Tab statt eine pro Aufruf (jeder Lauf speichert
// mehrfach); bei Fehler oder Schließen durch den Browser wird neu geöffnet.
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => { dbPromise = null; };
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

function putLocal(id: string, text: string): Promise<void> {
  return openDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(text, id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  }));
}

/** Nur der lokale Stand (IndexedDB), ohne Server */
export function loadCsvTextLocal(id: string): Promise<string | null> {
  return openDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  }));
}

export function deleteCsvTextLocal(id: string): Promise<void> {
  return openDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  }));
}

/** IDs aller lokal gespeicherten CSV-Texte */
export function localCsvIds(): Promise<string[]> {
  return openDb().then(db => new Promise<string[]>((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve((req.result as IDBValidKey[]).map(String));
    req.onerror   = () => reject(req.error);
  })).catch(() => []);
}

export async function saveCsvText(id: string, text: string): Promise<void> {
  await putLocal(id, text);
  markCsvText(id, 'set');
}

/**
 * CSV-Text lesen: lokal, außer der Server hat einen neueren Stand (anderes
 * Gerät hat geschrieben) oder lokal fehlt er — dann vom Server holen und
 * lokal ablegen. Ohne Server oder bei Netzfehler zählt der lokale Stand.
 */
export async function loadCsvText(id: string): Promise<string | null> {
  const key = `csv_text_${id}`;
  const local = await loadCsvTextLocal(id).catch(() => null);
  const remote = remoteStamp(key);
  if (!remote || getStoreStatus() === 'local' || (local !== null && localStamp(key) === remote) || hasPending(key)) return local;
  try {
    const got = await fetchValue(key);
    if (!got) return local;
    const text = await unpackText(got.value);
    await putLocal(id, text).catch(() => {});
    setStamps(key, got.updatedAt);
    return text;
  } catch { return local; }
}

export async function deleteCsvText(id: string): Promise<void> {
  await deleteCsvTextLocal(id).catch(() => {});
  markCsvText(id, 'del');
}
