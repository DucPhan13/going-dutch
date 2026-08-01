import type { Expense, Group, Member, Transaction } from "../types/index.js";
import { isCalendarDate, toCalendarDate } from "../lib/calendar-date.js";
import { isVndAmount } from "../lib/money.js";
import { type EntityMetadata, GROUP_DOCUMENT_SCHEMA_VERSION, GroupDocument, SyncError } from "./types.js";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === "string";
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function assertId(value: unknown, label: string) {
  if (!isText(value) || !value.trim()) throw new SyncError("invalid-data", `${label} must have an id.`);
}

function assertMember(value: unknown): asserts value is Member {
  if (!isObject(value)) throw new SyncError("invalid-data", "A member must be an object.");
  assertId(value.id, "Member");
  if (!isText(value.name) || !value.name.trim()) throw new SyncError("invalid-data", "A member must have a name.");
}

function assertExpense(value: unknown, memberIds: Set<string>, allowLegacyDate = false): asserts value is Expense {
  if (!isObject(value)) throw new SyncError("invalid-data", "An expense must be an object.");
  assertId(value.id, "Expense");
  if (!isText(value.description) || !value.description.trim() || !isVndAmount(value.amount)) {
    throw new SyncError("invalid-data", "An expense has invalid details.");
  }
  if (!isText(value.paidBy) || !memberIds.has(value.paidBy) || !Array.isArray(value.participants) || value.participants.length === 0 || !value.participants.every(id => isText(id) && memberIds.has(id))) {
    throw new SyncError("invalid-data", "An expense references an unknown member.");
  }
  if (value.date !== undefined && !(allowLegacyDate ? toCalendarDate(value.date) : isCalendarDate(value.date))) {
    throw new SyncError("invalid-data", "An expense must use a valid calendar date.");
  }
  if (value.splitValues !== undefined && (!isObject(value.splitValues) || !Object.values(value.splitValues).every(isFiniteNumber))) {
    throw new SyncError("invalid-data", "An expense has invalid split values.");
  }
}

function assertTransaction(value: unknown, memberIds: Set<string>): asserts value is Transaction {
  if (!isObject(value)) throw new SyncError("invalid-data", "A transaction must be an object.");
  assertId(value.id, "Transaction");
  if (!isText(value.from) || !isText(value.to) || !memberIds.has(value.from) || !memberIds.has(value.to) || !isVndAmount(value.amount) || !isText(value.paidAt) || !isText(value.originalBalanceId)) {
    throw new SyncError("invalid-data", "A transaction has invalid details.");
  }
}

export function validateLegacyGroup(value: unknown): asserts value is Group {
  if (!isObject(value)) throw new SyncError("invalid-data", "A group must be an object.");
  assertId(value.id, "Group");
  if (!isText(value.name) || !value.name.trim() || !Array.isArray(value.members) || !Array.isArray(value.expenses) || !Array.isArray(value.transactions)) {
    throw new SyncError("invalid-data", "A group has an invalid shape.");
  }
  value.members.forEach(assertMember);
  const memberIds = new Set(value.members.map(member => member.id));
  if (memberIds.size !== value.members.length) throw new SyncError("invalid-data", "A group contains duplicate member ids.");
  value.expenses.forEach(expense => assertExpense(expense, memberIds, true));
  value.transactions.forEach(transaction => assertTransaction(transaction, memberIds));
}

function metadata(deviceId: string, now: string) {
  return { createdAt: now, updatedAt: now, updatedBy: deviceId };
}

export function groupToDocument(group: Group, deviceId: string, now = new Date().toISOString()): GroupDocument {
  validateLegacyGroup(group);
  const memberMeta = metadata(deviceId, now);
  return {
    schemaVersion: GROUP_DOCUMENT_SCHEMA_VERSION,
    group: { id: group.id, name: group.name, ...metadata(deviceId, now) },
    membersById: Object.fromEntries(group.members.map(member => [member.id, { ...member, ...memberMeta }])),
    expensesById: Object.fromEntries(group.expenses.map(expense => [expense.id, { ...expense, ...(expense.date ? { date: toCalendarDate(expense.date) } : {}), ...metadata(deviceId, now) }])),
    transactionsById: Object.fromEntries(group.transactions.map(transaction => [transaction.id, { ...transaction, ...metadata(deviceId, now) }])),
  };
}

export function validateDocument(value: unknown): asserts value is GroupDocument {
  if (!isObject(value) || value.schemaVersion !== GROUP_DOCUMENT_SCHEMA_VERSION || !isObject(value.group) || !isObject(value.membersById) || !isObject(value.expensesById) || !isObject(value.transactionsById)) {
    throw new SyncError("invalid-data", "This group document is not supported.");
  }
  const document = value as unknown as GroupDocument;
  assertId(document.group.id, "Group");
  if (!isText(document.group.name) || !document.group.name.trim()) throw new SyncError("invalid-data", "The group document has no name.");
  const assertRecord = (record: unknown, id: string, label: string) => {
    if (!isObject(record) || record.id !== id || !isText(record.createdAt) || !isText(record.updatedAt) || !isText(record.updatedBy) || (record.deletedAt !== undefined && !isText(record.deletedAt))) {
      throw new SyncError("invalid-data", `The group document has an invalid ${label}.`);
    }
  };
  assertRecord(document.group, document.group.id, "group");
  for (const [id, member] of Object.entries(document.membersById)) assertRecord(member, id, "member");
  for (const [id, expense] of Object.entries(document.expensesById)) assertRecord(expense, id, "expense");
  for (const [id, transaction] of Object.entries(document.transactionsById)) assertRecord(transaction, id, "transaction");

  const memberIds = new Set(Object.values(document.membersById).filter(member => !member.deletedAt).map(member => member.id));
  for (const expense of Object.values(document.expensesById)) {
    if (!expense.deletedAt) assertExpense(expense, memberIds);
  }

  // Validate the materialised ledger as well as its CRDT envelope. Tombstones
  // are intentionally excluded: they preserve delete operations for a future
  // merge but must not satisfy references in the live ledger.
  validateLegacyGroup({
    id: document.group.id,
    name: document.group.name,
    members: Object.values(document.membersById).filter(member => !member.deletedAt),
    expenses: Object.values(document.expensesById).filter(expense => !expense.deletedAt),
    transactions: Object.values(document.transactionsById).filter(transaction => !transaction.deletedAt),
  });
}

const visible = <T extends { deletedAt?: string; createdAt: string; id: string }>(records: Record<string, T>) =>
  Object.values(records).filter(record => !record.deletedAt).sort((a, b) => `${a.createdAt}:${a.id}`.localeCompare(`${b.createdAt}:${b.id}`));

const withoutMetadata = <T extends object>(record: T) => {
  const { createdAt, updatedAt, updatedBy, deletedAt, ...plain } = record as T & EntityMetadata;
  return plain;
};

export function documentToGroup(document: GroupDocument): Group {
  validateDocument(document);
  return {
    id: document.group.id,
    name: document.group.name,
    members: visible(document.membersById).map(withoutMetadata) as Member[],
    expenses: visible(document.expensesById).map(withoutMetadata) as Expense[],
    transactions: visible(document.transactionsById).map(withoutMetadata) as Transaction[],
  };
}
