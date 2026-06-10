
const DB_VERSION = 1;
const STORE_FRAMES = "frames";
const STORE_LITE = "liteFrames";

function dbName(fileHash: string) {
  return `mcap-frame-cache-${fileHash}`;
}

export function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function frameKey(topicName: string, frameIndex: number) {
  return `${topicName}::${frameIndex}`;
}


let dbCache = new Map<string, IDBDatabase>();

async function openDb(fileHash: string): Promise<IDBDatabase> {
  if (dbCache.has(fileHash)) return dbCache.get(fileHash)!;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName(fileHash), DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_FRAMES)) {
        db.createObjectStore(STORE_FRAMES, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_LITE)) {
        db.createObjectStore(STORE_LITE, { keyPath: "key" });
      }
    };

    req.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      dbCache.set(fileHash, db);
      resolve(db);
    };

    req.onerror = () => reject(req.error);
  });
}


export interface CachedFrame {
  timestamp: number;
  width: number;
  height: number;
  bitmap: ImageBitmap;
}

export interface CachedLiteFrame {
  timestamp: number;
  width: number;
  height: number;
  dataUrl: string;
}


export async function cacheFrame(
  fileHash: string,
  topicName: string,
  frameIndex: number,
  timestamp: number,
  bitmap: ImageBitmap,
): Promise<void> {
  try {
    // Serialise bitmap → JPEG blob
    const oc = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = oc.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const blob = await oc.convertToBlob({ type: "image/jpeg", quality: 0.92 });

    const db = await openDb(fileHash);
    await idbPut(db, STORE_FRAMES, {
      key: frameKey(topicName, frameIndex),
      blob,
      timestamp,
      width: bitmap.width,
      height: bitmap.height,
    });
  } catch {
    // Non-fatal — just skip caching this frame
  }
}

/** Persist a lite (data-URL) frame. */
export async function cacheLiteFrame(
  fileHash: string,
  topicName: string,
  frameIndex: number,
  timestamp: number,
  dataUrl: string,
  width: number,
  height: number,
): Promise<void> {
  try {
    const db = await openDb(fileHash);
    await idbPut(db, STORE_LITE, {
      key: frameKey(topicName, frameIndex),
      dataUrl,
      timestamp,
      width,
      height,
    });
  } catch {
    // Non-fatal
  }
}


/** Load a single normal frame from the cache. Returns null on miss. */
export async function loadCachedFrame(
  fileHash: string,
  topicName: string,
  frameIndex: number,
): Promise<CachedFrame | null> {
  try {
    const db = await openDb(fileHash);
    const row = await idbGet<{ key: string; blob: Blob; timestamp: number; width: number; height: number }>(
      db, STORE_FRAMES, frameKey(topicName, frameIndex),
    );
    if (!row) return null;
    const bitmap = await createImageBitmap(row.blob);
    return { timestamp: row.timestamp, width: row.width, height: row.height, bitmap };
  } catch {
    return null;
  }
}

/** Load a single lite frame from the cache. Returns null on miss. */
export async function loadCachedLiteFrame(
  fileHash: string,
  topicName: string,
  frameIndex: number,
): Promise<CachedLiteFrame | null> {
  try {
    const db = await openDb(fileHash);
    const row = await idbGet<CachedLiteFrame & { key: string }>(
      db, STORE_LITE, frameKey(topicName, frameIndex),
    );
    if (!row) return null;
    return { timestamp: row.timestamp, width: row.width, height: row.height, dataUrl: row.dataUrl };
  } catch {
    return null;
  }
}

/**
 * Load ALL normal frames for a topic from the cache.
 * Returns an ordered array (sparse gaps filled with undefined) or null if
 * the topic has no cached entries at all.
 */
export async function loadAllCachedFrames(
  fileHash: string,
  topicName: string,
): Promise<CachedFrame[] | null> {
  try {
    const db = await openDb(fileHash);
    const prefix = `${topicName}::`;
    const rows = await idbGetAllWithPrefix<{ key: string; blob: Blob; timestamp: number; width: number; height: number }>(
      db, STORE_FRAMES, prefix,
    );
    if (rows.length === 0) return null;

    const frames: CachedFrame[] = [];
    await Promise.all(rows.map(async (row) => {
      const idx = parseInt(row.key.slice(prefix.length), 10);
      const bitmap = await createImageBitmap(row.blob);
      frames[idx] = { timestamp: row.timestamp, width: row.width, height: row.height, bitmap };
    }));
    return frames;
  } catch {
    return null;
  }
}

/**
 * Load ALL lite frames for a topic from the cache.
 */
export async function loadAllCachedLiteFrames(
  fileHash: string,
  topicName: string,
): Promise<CachedLiteFrame[] | null> {
  try {
    const db = await openDb(fileHash);
    const prefix = `${topicName}::`;
    const rows = await idbGetAllWithPrefix<{ key: string; dataUrl: string; timestamp: number; width: number; height: number }>(
      db, STORE_LITE, prefix,
    );
    if (rows.length === 0) return null;

    const frames: CachedLiteFrame[] = [];
    rows.forEach((row) => {
      const idx = parseInt(row.key.slice(prefix.length), 10);
      frames[idx] = { timestamp: row.timestamp, width: row.width, height: row.height, dataUrl: row.dataUrl };
    });
    return frames;
  } catch {
    return null;
  }
}

/**
 * Returns true if at least one frame for this topic exists in the cache.
 * Used as a fast existence check before loading all frames.
 */
export async function topicExistsInCache(
  fileHash: string,
  topicName: string,
  storeName: typeof STORE_FRAMES | typeof STORE_LITE = STORE_FRAMES,
): Promise<boolean> {
  try {
    const db = await openDb(fileHash);
    const prefix = `${topicName}::`;
    // Just check the first key with this prefix
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const range = IDBKeyRange.bound(prefix, prefix + "\uffff");
      const req = store.openCursor(range);
      req.onsuccess = () => resolve(req.result !== null);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/** Delete all cached data for a specific topic (e.g. on re-decode). */
export async function clearTopicCache(
  fileHash: string,
  topicName: string,
): Promise<void> {
  try {
    const db = await openDb(fileHash);
    const prefix = `${topicName}::`;
    await Promise.all([
      idbDeleteRange(db, STORE_FRAMES, prefix),
      idbDeleteRange(db, STORE_LITE, prefix),
    ]);
  } catch {
    // Non-fatal
  }
}


function idbPut(db: IDBDatabase, store: string, value: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAllWithPrefix<T>(db: IDBDatabase, store: string, prefix: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const range = IDBKeyRange.bound(prefix, prefix + "\uffff");
    const req = tx.objectStore(store).getAll(range);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function idbDeleteRange(db: IDBDatabase, store: string, prefix: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const s = tx.objectStore(store);
    const range = IDBKeyRange.bound(prefix, prefix + "\uffff");
    const req = s.openCursor(range);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
