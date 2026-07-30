import { openDB, type DBSchema } from "idb";

interface SyncDatabase extends DBSchema {
  documents: {
    key: string;
    value: { groupId: string; data: Uint8Array; updatedAt: string };
  };
  metadata: {
    key: string;
    value: { key: string; value: unknown };
  };
}

const DATABASE_NAME = "going-dutch-offline";
const DATABASE_VERSION = 1;

export const MIGRATION_KEY = "groups-localstorage-v1";

export async function syncDatabase() {
  return openDB<SyncDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("documents")) database.createObjectStore("documents", { keyPath: "groupId" });
      if (!database.objectStoreNames.contains("metadata")) database.createObjectStore("metadata", { keyPath: "key" });
    },
  });
}

export async function loadStoredDocuments() {
  return (await syncDatabase()).getAll("documents");
}

export async function saveStoredDocument(groupId: string, data: Uint8Array) {
  await (await syncDatabase()).put("documents", { groupId, data, updatedAt: new Date().toISOString() });
}

export async function migrationComplete() {
  return Boolean((await (await syncDatabase()).get("metadata", MIGRATION_KEY))?.value);
}

export async function saveMigration(documents: Array<{ groupId: string; data: Uint8Array }>) {
  const database = await syncDatabase();
  const transaction = database.transaction("documents", "readwrite");
  for (const document of documents) await transaction.objectStore("documents").put({ ...document, updatedAt: new Date().toISOString() });
  await transaction.done;

  const stored = await database.getAll("documents");
  const storedById = new Map(stored.map(document => [document.groupId, document]));
  const durable = documents.every(document => storedById.get(document.groupId)?.data.byteLength === document.data.byteLength);
  if (!durable) throw new Error("Migrated documents could not be verified.");

  await database.put("metadata", { key: MIGRATION_KEY, value: { completedAt: new Date().toISOString(), count: documents.length } });
}
