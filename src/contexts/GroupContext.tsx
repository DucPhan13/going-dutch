import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { Group, Member, Expense, Balance, Transaction } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/components/ui/use-toast";

interface GroupContextType {
  groups: Group[];
  currentGroup: Group | null;
  createGroup: (name: string) => void;
  selectGroup: (id: string) => void;
  addMember: (nameInput: string) => void;
  addMemberToGroup: (groupId: string, name: string) => void;
  editMember: (id: string, name: string) => void;
  removeMember: (id: string) => void;
  addExpense: (expense: Omit<Expense, "id">) => void;
  editExpense: (id: string, expense: Omit<Expense, "id">) => void;
  removeExpense: (id: string) => void;
  calculateBalances: () => Balance[];
  markBalanceAsPaid: (balance: Balance, paymentMethod?: string) => void;
  clearTransactions: () => void;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export const GroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem("groups");
    return saved ? JSON.parse(saved) : [];
  });
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const { toast } = useToast();

  // Persist groups (including transactions) to localStorage
  useEffect(() => {
    localStorage.setItem("groups", JSON.stringify(groups));
  }, [groups]);

  const currentGroup = groups.find(g => g.id === currentGroupId) || null;

  const createGroup = (name: string) => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Group name cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    const newGroup: Group = {
      id: uuidv4(),
      name,
      members: [],
      expenses: [],
      transactions: []
    };
    
    setGroups([...groups, newGroup]);
    setCurrentGroupId(newGroup.id);
    toast({
      title: "Group created",
      description: `${name} has been created successfully.`,
    });
  };

  const selectGroup = useCallback((id: string) => {
    setCurrentGroupId(id);
  }, []);

  const addMember = (nameInput: string) => {
    if (!currentGroup) {
      toast({
        title: "Error",
        description: "No group selected.",
        variant: "destructive",
      });
      return;
    }
    
    const names = nameInput.split(',').map(name => name.trim()).filter(name => name !== '');
    
    if (names.length === 0) {
      toast({
        title: "Error",
        description: "No valid names provided.",
        variant: "destructive",
      });
      return;
    }
    
    const newMembers: Member[] = names.map(name => ({
      id: uuidv4(),
      name,
    }));

    setGroups(groups.map(group => 
      group.id === currentGroup.id 
        ? { ...group, members: [...group.members, ...newMembers] }
        : group
    ));
    
    toast({
      title: names.length > 1 ? "Members added" : "Member added",
      description: names.length > 1 
        ? `${names.length} members have been added to ${currentGroup.name}.`
        : `${names[0]} has been added to ${currentGroup.name}.`,
    });
  };

  const addMemberToGroup = (groupId: string, name: string) => {
    const trimmedName = name.trim();
    const group = groups.find(item => item.id === groupId);
    if (!trimmedName || !group) return;
    setGroups(groups.map(item => item.id === groupId ? { ...item, members: [...item.members, { id: uuidv4(), name: trimmedName }] } : item));
    toast({ title: 'Friend added', description: `${trimmedName} was added to ${group.name}.` });
  };

  const editMember = (id: string, name: string) => {
    if (!currentGroup) {
      toast({
        title: "Error",
        description: "No group selected.",
        variant: "destructive",
      });
      return;
    }

    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Member name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setGroups(groups.map(group => 
      group.id === currentGroup.id 
        ? { 
            ...group, 
            members: group.members.map(member => 
              member.id === id ? { ...member, name } : member
            )
          }
        : group
    ));
    
    toast({
      title: "Member updated",
      description: `The member has been updated to "${name}".`,
    });
  };

  const removeMember = (id: string) => {
    if (!currentGroup) {
      toast({
        title: "Error",
        description: "No group selected.",
        variant: "destructive",
      });
      return;
    }

    const memberInExpenses = currentGroup.expenses.some(
      expense => expense.paidBy === id || expense.participants.includes(id)
    );

    if (memberInExpenses) {
      toast({
        title: "Cannot remove member",
        description: "This member is part of one or more expenses. Edit the expenses first.",
        variant: "destructive"
      });
      return;
    }

    const memberName = currentGroup.members.find(m => m.id === id)?.name || "Member";

    setGroups(groups.map(group => 
      group.id === currentGroup.id 
        ? { 
            ...group, 
            members: group.members.filter(member => member.id !== id)
          }
        : group
    ));
    
    toast({
      title: "Member removed",
      description: `${memberName} has been removed from the group.`,
    });
  };

  const addExpense = (expenseData: Omit<Expense, "id">) => {
    if (!currentGroup) {
      toast({
        title: "Error",
        description: "No group selected.",
        variant: "destructive",
      });
      return;
    }
    
    if (expenseData.amount <= 0) {
      toast({
        title: "Error",
        description: "Expense amount must be positive.",
        variant: "destructive",
      });
      return;
    }

    const newExpense: Expense = {
      id: uuidv4(),
      ...expenseData
    };

    setGroups(groups.map(group => 
      group.id === currentGroup.id 
        ? { ...group, expenses: [...group.expenses, newExpense] }
        : group
    ));
    
    toast({
      title: "Expense added",
      description: `${expenseData.description} (${expenseData.amount.toFixed(2)}) has been added.`,
    });
  };

  const editExpense = (id: string, expenseData: Omit<Expense, "id">) => {
    if (!currentGroup) {
      toast({
        title: "Error",
        description: "No group selected.",
        variant: "destructive",
      });
      return;
    }

    if (expenseData.amount <= 0) {
      toast({
        title: "Error",
        description: "Expense amount must be positive.",
        variant: "destructive",
      });
      return;
    }

    setGroups(groups.map(group => 
      group.id === currentGroup.id 
        ? { 
            ...group, 
            expenses: group.expenses.map(expense => 
              expense.id === id ? { ...expenseData, id } : expense
            )
          }
        : group
    ));
    
    toast({
      title: "Expense updated",
      description: `${expenseData.description} (${expenseData.amount.toFixed(2)}) has been updated.`,
    });
  };

  const removeExpense = (id: string) => {
    if (!currentGroup) {
      toast({
        title: "Error",
        description: "No group selected.",
        variant: "destructive",
      });
      return;
    }

    const expense = currentGroup.expenses.find(e => e.id === id);
    
    if (!expense) {
      toast({
        title: "Error",
        description: "Expense not found.",
        variant: "destructive",
      });
      return;
    }

    setGroups(groups.map(group => 
      group.id === currentGroup.id 
        ? { 
            ...group, 
            expenses: group.expenses.filter(expense => expense.id !== id)
          }
        : group
    ));
    
    toast({
      title: "Expense removed",
      description: `${expense.description} (${expense.amount.toFixed(2)}) has been removed.`,
    });
  };

  const calculateBalances = useCallback((): Balance[] => {
    if (!currentGroup) return [];

    const memberBalances: Record<string, number> = {};
    currentGroup.members.forEach(member => {
      memberBalances[member.id] = 0;
    });

    currentGroup.expenses.forEach(expense => {
      memberBalances[expense.paidBy] += expense.amount;
      const values = expense.splitValues || {};
      const totalValue = expense.participants.reduce((sum, id) => sum + (values[id] || 0), 0);
      expense.participants.forEach(participantId => {
        let share = expense.amount / expense.participants.length;
        if (expense.splitType === 'exact') share = values[participantId] || 0;
        if (expense.splitType === 'percentage' || expense.splitType === 'shares' || expense.splitType === 'unequal') {
          share = totalValue > 0 ? expense.amount * ((values[participantId] || 0) / totalValue) : share;
        }
        memberBalances[participantId] -= share;
      });
    });

    const balances: Balance[] = [];
    const debtors = currentGroup.members.filter(m => memberBalances[m.id] < -0.01);
    const creditors = currentGroup.members.filter(m => memberBalances[m.id] > 0.01);

    debtors.forEach(debtor => {
      let remainingDebt = Math.abs(memberBalances[debtor.id]);
      for (const creditor of creditors) {
        if (memberBalances[creditor.id] <= 0.01) continue;
        const paymentAmount = Math.min(remainingDebt, memberBalances[creditor.id]);
        if (paymentAmount > 0.01) {
          const roundedAmount = Math.ceil(paymentAmount / 1000) * 1000;
          balances.push({
            id: uuidv4(),
            from: debtor.id,
            to: creditor.id,
            amount: roundedAmount
          });
          remainingDebt -= paymentAmount;
          memberBalances[creditor.id] -= paymentAmount;
        }
        if (remainingDebt < 0.01) break;
      }
    });

    // Filter out balances that have been paid (recorded as transactions)
    return balances.filter(balance => 
      !currentGroup.transactions.some(tx => 
        tx.originalBalanceId === balance.id ||
        (tx.from === balance.from && 
         tx.to === balance.to && 
         Math.abs(tx.amount - balance.amount) < 1000)
      )
    );
  }, [currentGroup]);

  const markBalanceAsPaid = (balance: Balance, paymentMethod = 'Cash') => {
    if (!currentGroup) {
      toast({
        title: "Error",
        description: "No group selected.",
        variant: "destructive",
      });
      return;
    }

    // Validate balance
    if (!currentGroup.members.some(m => m.id === balance.from) || 
        !currentGroup.members.some(m => m.id === balance.to)) {
      toast({
        title: "Error",
        description: "Invalid balance: one or more members not found.",
        variant: "destructive",
      });
      return;
    }

    if (balance.amount <= 0) {
      toast({
        title: "Error",
        description: "Balance amount must be positive.",
        variant: "destructive",
      });
      return;
    }

    // Prevent duplicate transactions
    if (currentGroup.transactions.some(tx => tx.originalBalanceId === balance.id)) {
      toast({
        title: "Error",
        description: "This balance has already been recorded as a transaction.",
        variant: "destructive",
      });
      return;
    }

    // Create a new transaction
    const transaction: Transaction = {
      id: uuidv4(),
      from: balance.from,
      to: balance.to,
      amount: balance.amount,
      paidAt: new Date().toISOString(),
      originalBalanceId: balance.id,
      paymentMethod,
    };
    
    setGroups(groups.map(group => 
      group.id === currentGroup.id 
        ? { ...group, transactions: [...group.transactions, transaction] }
        : group
    ));
    
    const fromName = currentGroup.members.find(m => m.id === balance.from)?.name || "Unknown";
    const toName = currentGroup.members.find(m => m.id === balance.to)?.name || "Unknown";
    
    toast({
      title: "Transaction created",
      description: `${balance.amount.toLocaleString("vi-VN")} đ from ${fromName} to ${toName} has been recorded.`,
    });
  };

  const clearTransactions = () => {
    if (!currentGroup) {
      toast({
        title: "Error",
        description: "No group selected.",
        variant: "destructive",
      });
      return;
    }

    const count = currentGroup.transactions.length;
    setGroups(groups.map(group => 
      group.id === currentGroup.id 
        ? { ...group, transactions: [] }
        : group
    ));
    
    toast({
      title: "Transaction history cleared",
      description: `${count} transaction${count !== 1 ? "s" : ""} cleared successfully.`,
    });
  };

  return (
    <GroupContext.Provider value={{
      groups,
      currentGroup,
      createGroup,
      selectGroup,
      addMember,
      addMemberToGroup,
      editMember,
      removeMember,
      addExpense,
      editExpense,
      removeExpense,
      calculateBalances,
      markBalanceAsPaid,
      clearTransactions,
    }}>
      {children}
    </GroupContext.Provider>
  );
};

export const useGroupContext = () => {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error("useGroupContext must be used within a GroupProvider");
  }
  return context;
};
