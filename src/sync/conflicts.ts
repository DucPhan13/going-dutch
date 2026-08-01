import type { GroupDocument } from "./types.js";

export type ConflictLookup = (object: object, property: string) => Record<string, unknown> | undefined;

const GROUP_FIELDS = ["name", "deletedAt"];
const MEMBER_FIELDS = ["name", "deletedAt"];
const EXPENSE_FIELDS = ["description", "amount", "paidBy", "participants", "date", "category", "notes", "receiptData", "splitType", "splitValues", "deletedAt"];
const TRANSACTION_FIELDS = ["from", "to", "amount", "paidAt", "originalBalanceId", "paymentMethod", "deletedAt"];

function recordConflicts(prefix: string, record: object, fields: readonly string[], getConflicts: ConflictLookup) {
  return fields.flatMap(field => getConflicts(record, field) ? [`${prefix}.${field}`] : []);
}

/** Lists ledger edits that Automerge retained as concurrent values. */
export function findLedgerConflicts(document: GroupDocument, getConflicts: ConflictLookup): string[] {
  return [
    ...recordConflicts("group", document.group, GROUP_FIELDS, getConflicts),
    ...Object.entries(document.membersById).flatMap(([id, member]) => recordConflicts(`membersById.${id}`, member, MEMBER_FIELDS, getConflicts)),
    ...Object.entries(document.expensesById).flatMap(([id, expense]) => recordConflicts(`expensesById.${id}`, expense, EXPENSE_FIELDS, getConflicts)),
    ...Object.entries(document.transactionsById).flatMap(([id, transaction]) => recordConflicts(`transactionsById.${id}`, transaction, TRANSACTION_FIELDS, getConflicts)),
  ];
}
