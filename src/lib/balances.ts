import type { Balance, Expense, Group } from "../types/index.js";

function allocateWholeVnd(expense: Expense): Array<{ memberId: string; amount: number }> {
  const participants = expense.participants;
  if (!participants.length) return [];
  const values = expense.splitValues || {};
  const splitType = expense.splitType || "equal";

  if (splitType === "exact") {
    return participants.map(memberId => ({ memberId, amount: values[memberId] || 0 }));
  }

  const weights = splitType === "equal"
    ? participants.map(() => 1)
    : participants.map(memberId => values[memberId] || 0);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  if (totalWeight <= 0) return participants.map(memberId => ({ memberId, amount: 0 }));

  const allocations = weights.map((weight, index) => {
    const numerator = expense.amount * weight;
    const amount = Math.floor(numerator / totalWeight);
    return { memberId: participants[index], amount, remainder: numerator % totalWeight, index };
  });
  const remaining = expense.amount - allocations.reduce((total, allocation) => total + allocation.amount, 0);
  allocations.sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let index = 0; index < remaining; index += 1) allocations[index].amount += 1;
  return allocations.sort((left, right) => left.index - right.index).map(({ memberId, amount }) => ({ memberId, amount }));
}

/** Returns minimal, whole-VND settlement suggestions after every payment. */
export function calculateSettlementBalances(group: Group): Balance[] {
  const netByMember = new Map(group.members.map(member => [member.id, 0]));

  for (const expense of group.expenses) {
    if (!netByMember.has(expense.paidBy)) continue;
    netByMember.set(expense.paidBy, (netByMember.get(expense.paidBy) || 0) + expense.amount);
    for (const { memberId, amount } of allocateWholeVnd(expense)) {
      if (netByMember.has(memberId)) netByMember.set(memberId, (netByMember.get(memberId) || 0) - amount);
    }
  }

  for (const transaction of group.transactions) {
    if (!netByMember.has(transaction.from) || !netByMember.has(transaction.to)) continue;
    netByMember.set(transaction.from, (netByMember.get(transaction.from) || 0) + transaction.amount);
    netByMember.set(transaction.to, (netByMember.get(transaction.to) || 0) - transaction.amount);
  }

  const debtors = group.members.map(member => ({ id: member.id, amount: netByMember.get(member.id) || 0 })).filter(member => member.amount < 0);
  const creditors = group.members.map(member => ({ id: member.id, amount: netByMember.get(member.id) || 0 })).filter(member => member.amount > 0);
  const balances: Balance[] = [];

  for (const debtor of debtors) {
    let remainingDebt = -debtor.amount;
    for (const creditor of creditors) {
      if (creditor.amount <= 0 || remainingDebt <= 0) continue;
      const amount = Math.min(remainingDebt, creditor.amount);
      balances.push({ id: `settlement-${debtor.id}-${creditor.id}`, from: debtor.id, to: creditor.id, amount });
      remainingDebt -= amount;
      creditor.amount -= amount;
    }
  }

  return balances;
}
