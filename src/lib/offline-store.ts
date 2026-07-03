// Dependency-free IndexedDB wrapper for offline review. Two stores:
//   - queue:  cached due-word sets, keyed by scope id ("all" or a folderId)
//   - outbox: review outcomes awaiting sync, keyed by a client-generated id
// All functions no-op / return empty when IndexedDB is unavailable (SSR, or a
// browser without support) so callers can use them unconditionally.

import type { ReviewWord } from "@/app/(app)/cards/actions";
import type { SrsGrade } from "@/lib/srs";

/** Absolute post-review word state, computed client-side (idempotent on sync). */
export interface ReviewOutcomeState {
  fsrsStability: number;
  fsrsDifficulty: number;
  fsrsState: number;
  fsrsLearningSteps: number;
  nextReviewAt: string; // ISO
  rememberedCount: number;
  notRememberedCount: number;
}

export interface OutboxEntry {
  reviewId: string;
  wordId: string;
  grade: SrsGrade;
  reviewedAt: string; // ISO
  resulting: ReviewOutcomeState;
}

const DB_NAME = "vocab-offline";
const DB_VERSION = 1;
const QUEUE_STORE = "queue";
const OUTBOX_STORE = "outbox";

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "scopeId" });
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: "reviewId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(store, mode).objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

// --- queue ----------------------------------------------------------------

export async function saveQueue(
  scopeId: string,
  words: ReviewWord[]
): Promise<void> {
  if (!hasIDB()) return;
  try {
    await tx(QUEUE_STORE, "readwrite", (s) =>
      s.put({ scopeId, words, savedAt: Date.now() })
    );
  } catch {
    /* best-effort cache */
  }
}

export async function loadQueue(scopeId: string): Promise<ReviewWord[] | null> {
  if (!hasIDB()) return null;
  try {
    const row = await tx<{ words: ReviewWord[] } | undefined>(
      QUEUE_STORE,
      "readonly",
      (s) => s.get(scopeId)
    );
    return row?.words ?? null;
  } catch {
    return null;
  }
}

// --- outbox ---------------------------------------------------------------

export async function enqueueOutbox(entry: OutboxEntry): Promise<void> {
  if (!hasIDB()) return;
  await tx(OUTBOX_STORE, "readwrite", (s) => s.put(entry));
}

export async function listOutbox(): Promise<OutboxEntry[]> {
  if (!hasIDB()) return [];
  try {
    const all = await tx<OutboxEntry[]>(OUTBOX_STORE, "readonly", (s) =>
      s.getAll()
    );
    return all.sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt));
  } catch {
    return [];
  }
}

export async function getOutbox(reviewId: string): Promise<OutboxEntry | undefined> {
  if (!hasIDB()) return undefined;
  try {
    return await tx<OutboxEntry | undefined>(OUTBOX_STORE, "readonly", (s) =>
      s.get(reviewId)
    );
  } catch {
    return undefined;
  }
}

export async function deleteOutbox(reviewId: string): Promise<void> {
  if (!hasIDB()) return;
  await tx(OUTBOX_STORE, "readwrite", (s) => s.delete(reviewId));
}

export async function outboxCount(): Promise<number> {
  return (await listOutbox()).length;
}

/** Word ids with a still-pending outcome, to avoid re-reviewing them. */
export async function outboxWordIds(): Promise<Set<string>> {
  return new Set((await listOutbox()).map((e) => e.wordId));
}
