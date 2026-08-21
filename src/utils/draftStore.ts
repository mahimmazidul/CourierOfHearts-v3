// Draft persistence. Letters can grow large, so drafts live in IndexedDB, not
// localStorage (which stays reserved for tiny state like management tokens).
// Corrupted or unavailable storage must never crash the app — every call is
// failure-tolerant and simply degrades to "no draft".

export interface LetterDraft {
  version: 1;
  savedAt: string;
  salutation: string;
  salutationEnabled: boolean;
  recipient: string;
  content: string;
  closing: string;
  signature: string;
  sealType: string;
  sealColor: string;
  crest: string;
  customInitials: string;
  bodyFont: string;
  signatureFont: string;
  flowers: unknown[];
}

const DB_NAME = 'courierofhearts';
const STORE = 'drafts';
const KEY = 'compose-draft';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveDraft(draft: Omit<LetterDraft, 'version' | 'savedAt'>): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const txn = db.transaction(STORE, 'readwrite');
    txn.objectStore(STORE).put({ ...draft, version: 1, savedAt: new Date().toISOString() }, KEY);
    txn.oncomplete = () => db.close();
    txn.onerror = () => db.close();
  } catch {
    db.close();
  }
}

export async function loadDraft(): Promise<LetterDraft | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const txn = db.transaction(STORE, 'readonly');
      const request = txn.objectStore(STORE).get(KEY);
      request.onsuccess = () => {
        db.close();
        const value = request.result as LetterDraft | undefined;
        // Version check == schema migration point for future draft formats.
        if (value && value.version === 1 && typeof value.content === 'string') resolve(value);
        else resolve(null);
      };
      request.onerror = () => { db.close(); resolve(null); };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function clearDraft(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const txn = db.transaction(STORE, 'readwrite');
    txn.objectStore(STORE).delete(KEY);
    txn.oncomplete = () => db.close();
    txn.onerror = () => db.close();
  } catch {
    db.close();
  }
}

/** Debounce helper for autosave. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
