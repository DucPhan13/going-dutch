import assert from "node:assert/strict";
import test from "node:test";
import * as Automerge from "@automerge/automerge";
import { findLedgerConflicts } from "../src/sync/conflicts.js";
import type { GroupDocument } from "../src/sync/types.js";

const baseDocument: GroupDocument = {
  schemaVersion: 1,
  group: { id: "group", name: "Trip", createdAt: "2026-08-01", updatedAt: "2026-08-01", updatedBy: "seed" },
  membersById: {
    a: { id: "a", name: "A", createdAt: "2026-08-01", updatedAt: "2026-08-01", updatedBy: "seed" },
    b: { id: "b", name: "B", createdAt: "2026-08-01", updatedAt: "2026-08-01", updatedBy: "seed" },
  },
  expensesById: {
    lunch: { id: "lunch", description: "Lunch", amount: 30_000, paidBy: "a", participants: ["a", "b"], createdAt: "2026-08-01", updatedAt: "2026-08-01", updatedBy: "seed" },
  },
  transactionsById: {},
};

test("concurrent expense edits are reported for manual resolution", () => {
  const base = Automerge.from(baseDocument, { actor: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
  const local = Automerge.change(base, draft => { draft.expensesById.lunch.description = "Lunch at A"; });
  const remote = Automerge.change(Automerge.clone(base, { actor: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }), draft => { draft.expensesById.lunch.description = "Lunch at B"; });
  const merged = Automerge.merge(local, remote);

  assert.deepEqual(findLedgerConflicts(merged, Automerge.getConflicts as unknown as Parameters<typeof findLedgerConflicts>[1]), ["expensesById.lunch.description"]);
});
