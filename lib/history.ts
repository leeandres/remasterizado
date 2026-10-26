import { openDB, type IDBPDatabase } from "idb";
import type { HistoryEntry } from "./types";

const DB_NAME = "masterai-pro";
const STORE = "masters";
const MAX_ENTRIES = 8;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("createdAt", "createdAt");
        }
      },
    });
  }
  return dbPromise;
}

async function trim(db: IDBPDatabase) {
  const all = (await db.getAll(STORE)) as HistoryEntry[];
  if (all.length <= MAX_ENTRIES) return;
  all.sort((a, b) => b.createdAt - a.createdAt);
  for (const entry of all.slice(MAX_ENTRIES)) {
    await db.delete(STORE, entry.id);
  }
}

export async function saveHistoryEntry(entry: HistoryEntry): Promise<void> {
  const db = await getDb();
  try {
    await db.put(STORE, entry);
  } catch (error) {
    // Quota exceeded: drop the oldest entries and retry once.
    const all = (await db.getAll(STORE)) as HistoryEntry[];
    all.sort((a, b) => a.createdAt - b.createdAt);
    for (const old of all.slice(0, Math.ceil(all.length / 2) + 1)) {
      await db.delete(STORE, old.id);
    }
    try {
      await db.put(STORE, entry);
    } catch {
      throw new Error(
        "No hay espacio local para guardar el audio. Descarga el archivo y borra masterizaciones antiguas.",
        { cause: error },
      );
    }
  }
  await trim(db);
}

export async function listHistoryEntries(): Promise<HistoryEntry[]> {
  try {
    const db = await getDb();
    const all = (await db.getAll(STORE)) as HistoryEntry[];
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

export async function clearHistory(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE);
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const estimate = await navigator.storage.estimate();
  return {
    usage: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
  };
}
