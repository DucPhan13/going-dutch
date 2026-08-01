import type { Expense, Group, Member, Transaction } from "../types/index.js";

export const GROUP_DOCUMENT_SCHEMA_VERSION = 1;

export type SyncErrorCode =
  | "storage-unavailable"
  | "not-ready"
  | "group-not-found"
  | "invalid-data"
  | "sync-conflict"
  | "unsupported-archive"
  | "archive-too-large"
  | "decryption-failed";

export class SyncError extends Error {
  constructor(public readonly code: SyncErrorCode, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "SyncError";
  }
}

export interface EntityMetadata {
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  deletedAt?: string;
}

export type SyncMember = Member & EntityMetadata;
export type SyncExpense = Expense & EntityMetadata;
export type SyncTransaction = Transaction & EntityMetadata;

export interface SyncGroup extends EntityMetadata {
  id: string;
  name: string;
}

/**
 * A group is deliberately a separate document. It lets people exchange one
 * ledger without accidentally including every other local group in an export.
 */
export interface GroupDocument extends Record<string, unknown> {
  schemaVersion: typeof GROUP_DOCUMENT_SCHEMA_VERSION;
  group: SyncGroup;
  membersById: Record<string, SyncMember>;
  expensesById: Record<string, SyncExpense>;
  transactionsById: Record<string, SyncTransaction>;
}

export interface ExportGroupArchiveResult {
  groupId: string;
  filename: string;
  blob: Blob;
  byteLength: number;
}

export interface ImportGroupArchiveResult {
  status: "added" | "merged";
  groupId: string;
  groupName: string;
  memberCount: number;
  expenseCount: number;
  group: Group;
  importedAsNew: boolean;
  merged: boolean;
}
