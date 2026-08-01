import assert from "node:assert/strict";
import test from "node:test";
import { calculateSettlementBalances } from "../src/lib/balances.js";
import { isCalendarDate } from "../src/lib/calendar-date.js";
import { parseVndAmount } from "../src/lib/money.js";
import { groupToDocument, validateLegacyGroup } from "../src/sync/schema.js";

test("expense amount shorthand expands only values below one thousand", () => {
  assert.equal(parseVndAmount("30"), 30_000);
  assert.equal(parseVndAmount("30000"), 30_000);
  assert.equal(parseVndAmount("30.5"), null);
});

test("a recorded payment offsets historical debt before later expenses", () => {
  const balances = calculateSettlementBalances({
    id: "group",
    name: "Dinner",
    members: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
    expenses: [
      { id: "first", description: "First", amount: 100_000, paidBy: "b", participants: ["a"] },
      { id: "later", description: "Later", amount: 20_000, paidBy: "b", participants: ["a"] },
    ],
    transactions: [{ id: "paid", from: "a", to: "b", amount: 100_000, paidAt: "2026-08-01T00:00:00.000Z", originalBalanceId: "old" }],
  });

  assert.deepEqual(balances.map(({ from, to, amount }) => ({ from, to, amount })), [{ from: "a", to: "b", amount: 20_000 }]);
});

test("settlements preserve exact VND rather than rounding to thousands", () => {
  const balances = calculateSettlementBalances({
    id: "group",
    name: "Small debt",
    members: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
    expenses: [{ id: "expense", description: "Small", amount: 500, paidBy: "b", participants: ["a"] }],
    transactions: [],
  });

  assert.equal(balances[0]?.amount, 500);
});

test("equal splits assign deterministic whole-VND remainders", () => {
  const balances = calculateSettlementBalances({
    id: "group",
    name: "Remainder",
    members: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }, { id: "payer", name: "Payer" }],
    expenses: [{ id: "expense", description: "One hundred", amount: 100, paidBy: "payer", participants: ["a", "b", "c"] }],
    transactions: [],
  });

  assert.deepEqual(balances.map(balance => balance.amount), [34, 33, 33]);
  assert.equal(balances.reduce((sum, balance) => sum + balance.amount, 0), 100);
});

test("expense dates are timezone-free calendar dates", () => {
  assert.equal(isCalendarDate("2026-02-29"), false);
  assert.equal(isCalendarDate("2028-02-29"), true);
  assert.equal(isCalendarDate("2026-08-01T12:00:00.000Z"), false);
});

test("legacy timestamps migrate to date-only records and decimal VND is rejected", () => {
  const legacyGroup = {
    id: "group",
    name: "Legacy",
    members: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
    expenses: [{ id: "expense", description: "Lunch", amount: 30_000, paidBy: "a", participants: ["a", "b"], date: "2026-08-01T12:00:00.000Z" }],
    transactions: [],
  };
  validateLegacyGroup(legacyGroup);
  assert.equal(groupToDocument(legacyGroup, "device").expensesById.expense.date, "2026-08-01");

  assert.throws(() => validateLegacyGroup({ ...legacyGroup, expenses: [{ ...legacyGroup.expenses[0], amount: 30_000.5 }] }));
});
