import * as Automerge from "@automerge/automerge/slim";
import automergeWasmUrl from "@automerge/automerge/automerge.wasm?url";
import type { Expense, Group, Member, Transaction } from "@/types";
import { archiveBase64ToBytes, archiveBytesToBase64, decryptArchive, encryptArchive } from "./archive";
import { toCalendarDate } from "@/lib/calendar-date";
import { documentToGroup, groupToDocument, validateDocument, validateLegacyGroup } from "./schema";
import { findLedgerConflicts, type ConflictLookup } from "./conflicts";
import { loadStoredDocuments, migrationComplete, saveMigration, saveStoredDocument } from "./storage";
import {
  type ExportGroupArchiveResult,
  type GroupDocument,
  type ImportGroupArchiveResult,
  SyncError,
} from "./types";

const LEGACY_GROUPS_KEY = "groups";
const LEGACY_BACKUP_KEY = "going-dutch-groups-legacy-v1";
const DEVICE_ID_KEY = "going-dutch-device-id-v1";
const automergeReady = Automerge.initializeWasm(automergeWasmUrl);

type MutableDocument = GroupDocument;

const now = () => new Date().toISOString();
const temporaryActorId = () => crypto.randomUUID().replace(/-/g, "");
const withoutUndefined = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function migrateDocumentDates(document: Automerge.Doc<GroupDocument>) {
  const datesNeedingMigration = Object.values(document.expensesById).some(expense => expense.date && toCalendarDate(expense.date) !== expense.date);
  if (!datesNeedingMigration) return document;
  return Automerge.change(document, draft => {
    for (const expense of Object.values(draft.expensesById)) {
      if (!expense.date) continue;
      const date = toCalendarDate(expense.date);
      if (date) expense.date = date;
    }
  });
}

function requireConflictResolution(document: Automerge.Doc<GroupDocument>) {
  const conflicts = findLedgerConflicts(document, Automerge.getConflicts as unknown as ConflictLookup);
  if (!conflicts.length) return;
  throw new SyncError("sync-conflict", `Concurrent edits need resolution before this group can merge (${conflicts.slice(0, 3).join(", ")}${conflicts.length > 3 ? ", …" : ""}).`);
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function parseLegacyGroups(): Group[] {
  const raw = localStorage.getItem(LEGACY_GROUPS_KEY);
  if (!raw) return [];
  try {
    const groups: unknown = JSON.parse(raw);
    if (!Array.isArray(groups)) throw new Error("not an array");
    groups.forEach(validateLegacyGroup);
    return groups;
  } catch (error) {
    throw new SyncError("invalid-data", "Existing local data could not be migrated safely.", error);
  }
}

function filenameFor(group: Group) {
  const safeName = group.name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase() || "group";
  return `${safeName}-${group.id.slice(0, 8)}.going-dutch-sync`;
}

export class GroupSyncRepository {
  private readonly documents = new Map<string, Automerge.Doc<GroupDocument>>();
  private readonly writes = new Map<string, Promise<void>>();
  private readonly listeners = new Set<(groupId: string) => void>();
  private readonly deviceId = getDeviceId();
  private initialized = false;

  async initialise() {
    if (this.initialized) return;
    try {
      await automergeReady;
      if (!(await migrationComplete())) {
        const legacyGroups = parseLegacyGroups();
        const prepared = legacyGroups.map(group => {
          const document = Automerge.from<GroupDocument>(groupToDocument(group, this.deviceId), { actor: this.deviceId });
          return { groupId: group.id, data: Automerge.save(document) };
        });
        // Preserve a recovery copy before changing the source of truth. This is
        // intentionally not removed after migration.
        if (localStorage.getItem(LEGACY_BACKUP_KEY) === null) localStorage.setItem(LEGACY_BACKUP_KEY, localStorage.getItem(LEGACY_GROUPS_KEY) || "[]");
        await saveMigration(prepared);
        localStorage.removeItem(LEGACY_GROUPS_KEY);
      }

      const stored = await loadStoredDocuments();
      for (const record of stored) {
        const loadedDocument = Automerge.load<GroupDocument>(record.data, { actor: this.deviceId });
        const document = migrateDocumentDates(loadedDocument);
        validateDocument(document);
        this.documents.set(document.group.id, document);
        if (document !== loadedDocument) {
          await saveStoredDocument(document.group.id, Automerge.save(document));
        }
      }
      this.initialized = true;
    } catch (error) {
      if (error instanceof SyncError) throw error;
      throw new SyncError("storage-unavailable", "Offline storage is unavailable in this browser.", error);
    }
  }

  isReady() {
    return this.initialized;
  }

  listGroups(): Group[] {
    return [...this.documents.values()]
      .filter(document => !document.group.deletedAt)
      .map(documentToGroup)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getGroup(groupId: string) {
    const document = this.documents.get(groupId);
    return document && !document.group.deletedAt ? documentToGroup(document) : undefined;
  }

  subscribeToLocalChanges(listener: (groupId: string) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  listDocumentSnapshots() {
    this.requireReady();
    return [...this.documents.entries()].map(([groupId, document]) => ({ groupId, data: Automerge.save(document) }));
  }

  getDocumentSnapshot(groupId: string) {
    this.requireReady();
    const document = this.documents.get(groupId);
    if (!document) return undefined;
    return { groupId, data: Automerge.save(document), heads: Automerge.getHeads(document).sort() };
  }

  async mergeRemoteDocument(data: Uint8Array) {
    this.requireReady();
    let imported: Automerge.Doc<GroupDocument>;
    try {
      imported = migrateDocumentDates(Automerge.load<GroupDocument>(data, { actor: temporaryActorId() }));
      validateDocument(imported);
    } catch (error) {
      if (error instanceof SyncError) throw error;
      throw new SyncError("invalid-data", "The incoming sync data is invalid.", error);
    }
    const groupId = imported.group.id;
    return this.serialise(groupId, async () => {
      const existing = this.documents.get(groupId);
      const merged = existing ? Automerge.merge(existing, imported) : imported;
      requireConflictResolution(merged);
      validateDocument(merged);
      await this.persist(groupId, merged, false);
      return { group: documentToGroup(merged), heads: Automerge.getHeads(merged).sort() };
    });
  }

  async createGroup(id: string, name: string) {
    return this.serialise(id, async () => {
      this.requireReady();
      const group: Group = { id, name, members: [], expenses: [], transactions: [] };
      const document = Automerge.from<GroupDocument>(groupToDocument(group, this.deviceId), { actor: this.deviceId });
      await this.persist(id, document);
      return documentToGroup(document);
    });
  }

  /**
   * Retain a CRDT tombstone so a later manual sync cannot resurrect the group.
   * Deleted documents remain available to the sync transport solely to propagate
   * that deletion to a device the user explicitly syncs with.
   */
  async removeGroup(groupId: string) {
    return this.mutate(groupId, draft => {
      const timestamp = now();
      draft.group.deletedAt = timestamp;
      draft.group.updatedAt = timestamp;
      draft.group.updatedBy = this.deviceId;
    });
  }

  async addMembers(groupId: string, members: Member[]) {
    return this.mutate(groupId, draft => {
      const timestamp = now();
      for (const member of members) {
        draft.membersById[member.id] = { ...member, createdAt: timestamp, updatedAt: timestamp, updatedBy: this.deviceId };
      }
    });
  }

  async editMember(groupId: string, memberId: string, name: string) {
    return this.mutate(groupId, draft => {
      const member = draft.membersById[memberId];
      if (!member || member.deletedAt) throw new SyncError("invalid-data", "Member not found.");
      member.name = name;
      member.updatedAt = now();
      member.updatedBy = this.deviceId;
    });
  }

  async removeMember(groupId: string, memberId: string) {
    return this.mutate(groupId, draft => {
      const member = draft.membersById[memberId];
      if (!member || member.deletedAt) throw new SyncError("invalid-data", "Member not found.");
      member.deletedAt = now();
      member.updatedAt = member.deletedAt;
      member.updatedBy = this.deviceId;
    });
  }

  async addExpense(groupId: string, expense: Expense) {
    return this.mutate(groupId, draft => {
      const timestamp = now();
      draft.expensesById[expense.id] = withoutUndefined({ ...expense, createdAt: timestamp, updatedAt: timestamp, updatedBy: this.deviceId });
    });
  }

  async editExpense(groupId: string, expenseId: string, expense: Omit<Expense, "id">) {
    return this.mutate(groupId, draft => {
      const current = draft.expensesById[expenseId];
      if (!current || current.deletedAt) throw new SyncError("invalid-data", "Expense not found.");
      const mutableExpense = current as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(expense)) {
        if (value === undefined) delete mutableExpense[key];
        else mutableExpense[key] = withoutUndefined(value);
      }
      Object.assign(current, { id: expenseId, updatedAt: now(), updatedBy: this.deviceId });
    });
  }

  async removeExpense(groupId: string, expenseId: string) {
    return this.mutate(groupId, draft => {
      const expense = draft.expensesById[expenseId];
      if (!expense || expense.deletedAt) throw new SyncError("invalid-data", "Expense not found.");
      expense.deletedAt = now();
      expense.updatedAt = expense.deletedAt;
      expense.updatedBy = this.deviceId;
    });
  }

  async addTransaction(groupId: string, transaction: Transaction) {
    return this.mutate(groupId, draft => {
      const timestamp = now();
      draft.transactionsById[transaction.id] = { ...transaction, createdAt: timestamp, updatedAt: timestamp, updatedBy: this.deviceId };
    });
  }

  async clearTransactions(groupId: string) {
    return this.mutate(groupId, draft => {
      const timestamp = now();
      for (const transaction of Object.values(draft.transactionsById)) {
        if (!transaction.deletedAt) {
          transaction.deletedAt = timestamp;
          transaction.updatedAt = timestamp;
          transaction.updatedBy = this.deviceId;
        }
      }
    });
  }

  async restoreTransactions(groupId: string, transactionIds: string[]) {
    return this.mutate(groupId, draft => {
      const timestamp = now();
      for (const transactionId of transactionIds) {
        const transaction = draft.transactionsById[transactionId];
        if (!transaction?.deletedAt) continue;
        delete transaction.deletedAt;
        transaction.updatedAt = timestamp;
        transaction.updatedBy = this.deviceId;
      }
    });
  }

  async exportGroupArchive(groupId: string, passphrase: string): Promise<ExportGroupArchiveResult> {
    this.requireReady();
    await this.waitForWrites(groupId);
    const document = this.documents.get(groupId);
    if (!document) throw new SyncError("group-not-found", "Group not found.");
    const group = documentToGroup(document);
    const bytes = Automerge.save(document);
    const blob = await encryptArchive({
      passphrase,
      groupId,
      exportedAt: now(),
      document: archiveBytesToBase64(bytes),
    });
    return { groupId, filename: filenameFor(group), blob, byteLength: blob.size };
  }

  async importGroupArchive(file: Blob, passphrase: string): Promise<ImportGroupArchiveResult> {
    this.requireReady();
    const payload = await decryptArchive(file, passphrase);
    if (typeof payload.groupId !== "string" || typeof payload.document !== "string") throw new SyncError("unsupported-archive", "This sync file has no group data.");
    let imported: Automerge.Doc<GroupDocument>;
    try {
      // Imported history needs a temporary actor handle before it is merged
      // into the local document. CRDT actor ids are anonymous and the entire
      // archive, including its history, is encrypted.
      imported = migrateDocumentDates(Automerge.load<GroupDocument>(archiveBase64ToBytes(payload.document), { actor: temporaryActorId() }));
      validateDocument(imported);
    } catch (error) {
      if (error instanceof SyncError) throw error;
      throw new SyncError("unsupported-archive", "This sync file contains invalid group data.", error);
    }
    if (imported.group.id !== payload.groupId) throw new SyncError("unsupported-archive", "This sync file has inconsistent group data.");

    return this.serialise(imported.group.id, async () => {
      const existing = this.documents.get(imported.group.id);
      const merged = existing ? Automerge.merge(existing, imported) : imported;
      requireConflictResolution(merged);
      validateDocument(merged);
      await this.persist(imported.group.id, merged);
      const group = documentToGroup(merged);
      return {
        status: existing ? "merged" : "added",
        groupId: imported.group.id,
        groupName: group.name,
        memberCount: group.members.length,
        expenseCount: group.expenses.length,
        group,
        importedAsNew: !existing,
        merged: Boolean(existing),
      };
    });
  }

  private async mutate(groupId: string, change: (draft: MutableDocument) => void) {
    return this.serialise(groupId, async () => {
      this.requireReady();
      const current = this.documents.get(groupId);
      if (!current) throw new SyncError("group-not-found", "Group not found.");
      const next = Automerge.change(current, change);
      validateDocument(next);
      await this.persist(groupId, next);
      return documentToGroup(next);
    });
  }

  private async persist(groupId: string, document: Automerge.Doc<GroupDocument>, notify = true) {
    await saveStoredDocument(groupId, Automerge.save(document));
    this.documents.set(groupId, document);
    if (notify) for (const listener of this.listeners) listener(groupId);
  }

  private requireReady() {
    if (!this.initialized) throw new SyncError("not-ready", "Your offline data is still loading.");
  }

  private async waitForWrites(groupId: string) {
    await this.writes.get(groupId);
  }

  private serialise<T>(groupId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.writes.get(groupId) || Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    this.writes.set(groupId, next.then(() => undefined, () => undefined));
    return next;
  }
}
