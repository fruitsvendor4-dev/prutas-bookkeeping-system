import type { BusinessTransaction, StoredTransaction } from "@/lib/types";

const DATABASE_NAME = "fruit-vendor-books";
const DATABASE_VERSION = 1;

type PendingDelete = { key: string; scope: string; id: string };

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Hindi available ang lokal na imbakan."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("records")) {
        const records = database.createObjectStore("records", { keyPath: "id" });
        records.createIndex("scope", "scope", { unique: false });
      }
      if (!database.objectStoreNames.contains("deletes")) {
        const deletes = database.createObjectStore("deletes", { keyPath: "key" });
        deletes.createIndex("scope", "scope", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Hindi mabuksan ang lokal na imbakan."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Hindi naisagawa ang lokal na tala."));
  });
}

export async function getLocalRecords(scope: string): Promise<StoredTransaction[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction("records", "readonly");
    return (await requestResult(transaction.objectStore("records").index("scope").getAll(scope))) as StoredTransaction[];
  } finally {
    database.close();
  }
}

export async function saveLocalRecord(scope: string, record: BusinessTransaction, synced = false): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction("records", "readwrite");
    transaction.objectStore("records").put({ ...record, scope, synced } satisfies StoredTransaction);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Hindi na-save ang tala."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Hindi na-save ang tala."));
    });
  } finally {
    database.close();
  }
}

export async function removeLocalRecord(scope: string, id: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(["records", "deletes"], "readwrite");
    const records = transaction.objectStore("records");
    const current = (await requestResult(records.get(id))) as StoredTransaction | undefined;
    if (current?.scope === scope) {
      records.delete(id);
      if (current.synced && scope !== "guest") {
        transaction.objectStore("deletes").put({ key: `${scope}:${id}`, scope, id } satisfies PendingDelete);
      }
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Hindi naalis ang tala."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Hindi naalis ang tala."));
    });
  } finally {
    database.close();
  }
}

export async function getPendingDeletes(scope: string): Promise<PendingDelete[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction("deletes", "readonly");
    return (await requestResult(transaction.objectStore("deletes").index("scope").getAll(scope))) as PendingDelete[];
  } finally {
    database.close();
  }
}

export async function removeSentDeletes(scope: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction("deletes", "readwrite");
    const store = transaction.objectStore("deletes");
    ids.forEach((id) => store.delete(`${scope}:${id}`));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Hindi naisabay ang pagbura."));
    });
  } finally {
    database.close();
  }
}

function transactionSignature(record: BusinessTransaction) {
  const fields: (keyof BusinessTransaction)[] = ["id", "type", "date", "fruit", "supplier", "quantity", "unit", "unitPrice", "amount", "category", "description", "paymentMethod", "capitalAction", "note"];
  return JSON.stringify(fields.map((field) => record[field] ?? null));
}

export async function markRecordsSynced(scope: string, snapshots: BusinessTransaction[]): Promise<void> {
  if (!snapshots.length) return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction("records", "readwrite");
    const store = transaction.objectStore("records");
    for (const snapshot of snapshots) {
      const current = (await requestResult(store.get(snapshot.id))) as StoredTransaction | undefined;
      if (current?.scope === scope && transactionSignature(current) === transactionSignature(snapshot)) {
        store.put({ ...current, synced: true });
      }
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Hindi na-update ang sync status."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Hindi na-update ang sync status."));
    });
  } finally {
    database.close();
  }
}

export async function mergeServerRecords(scope: string, records: BusinessTransaction[]): Promise<void> {
  if (!records.length) return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(["records", "deletes"], "readwrite");
    const store = transaction.objectStore("records");
    const deletes = transaction.objectStore("deletes");
    for (const record of records) {
      const current = (await requestResult(store.get(record.id))) as StoredTransaction | undefined;
      const pendingDelete = (await requestResult(deletes.get(`${scope}:${record.id}`))) as PendingDelete | undefined;
      if (pendingDelete || (current?.scope === scope && !current.synced)) continue;
      store.put({ ...record, scope, synced: true } satisfies StoredTransaction);
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Hindi nakuha ang mga naka-sync na tala."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Hindi nakuha ang mga naka-sync na tala."));
    });
  } finally {
    database.close();
  }
}

export function countUnsynced(records: StoredTransaction[]) {
  return records.filter((record) => !record.synced).length;
}
