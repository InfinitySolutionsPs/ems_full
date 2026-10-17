"use client";

export type OfflineIncident = {
  localId: string;
  payload: Record<string, unknown>;
  status: "pending" | "failed";
  attempts: number;
  createdAt: string;
  lastError?: string;
};

const DB_NAME = "ems-offline-v1";
const DB_VERSION = 1;
const QUEUE = "incident-queue";
const CACHE = "reference-cache";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: "localId" });
      if (!db.objectStoreNames.contains(CACHE)) db.createObjectStore(CACHE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function store<T>(name: string, mode: IDBTransactionMode, action: (value: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const request = action(tx.objectStore(name));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export function createOfflineIncidentCode() {
  const deviceKey = "ems_offline_device";
  let device = localStorage.getItem(deviceKey);
  if (!device) {
    device = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    localStorage.setItem(deviceKey, device);
  }
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `EMS-${new Date().getFullYear()}-L-${device}-${stamp}-${random}`;
}

export async function queueIncident(payload: Record<string, unknown>) {
  const item: OfflineIncident = {
    localId: String(payload.incidentCode || crypto.randomUUID()),
    payload,
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  await store(QUEUE, "readwrite", (queue) => queue.put(item));
  window.dispatchEvent(new CustomEvent("ems-offline-change"));
  return item;
}

export async function getQueuedIncidents(): Promise<OfflineIncident[]> {
  return store(QUEUE, "readonly", (queue) => queue.getAll());
}

export async function getQueueCount() {
  return store(QUEUE, "readonly", (queue) => queue.count());
}

export async function syncQueuedIncidents() {
  if (!navigator.onLine) return { synced: 0, failed: 0, remaining: await getQueueCount() };
  const queued = await getQueuedIncidents();
  let synced = 0;
  let failed = 0;
  for (const item of queued) {
    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "content-type": "application/json", "x-ems-offline-sync": "1" },
        body: JSON.stringify(item.payload),
      });
      const result = await response.json().catch(() => ({}));
      // 409 means the same globally unique incident code already reached the server.
      if (response.ok || response.status === 409) {
        await store(QUEUE, "readwrite", (queue) => queue.delete(item.localId));
        synced += 1;
      } else {
        item.status = "failed";
        item.attempts += 1;
        item.lastError = result.error || `HTTP ${response.status}`;
        await store(QUEUE, "readwrite", (queue) => queue.put(item));
        failed += 1;
      }
    } catch (error) {
      item.status = "failed";
      item.attempts += 1;
      item.lastError = error instanceof Error ? error.message : "network error";
      await store(QUEUE, "readwrite", (queue) => queue.put(item));
      failed += 1;
      break;
    }
  }
  window.dispatchEvent(new CustomEvent("ems-offline-change"));
  return { synced, failed, remaining: await getQueueCount() };
}

export async function cacheReferenceData(value: unknown) {
  await store(CACHE, "readwrite", (cache) => cache.put({ key: "settings", value, updatedAt: new Date().toISOString() }));
}

export async function getCachedReferenceData<T>() {
  const result = await store<any>(CACHE, "readonly", (cache) => cache.get("settings"));
  return (result?.value || null) as T | null;
}
