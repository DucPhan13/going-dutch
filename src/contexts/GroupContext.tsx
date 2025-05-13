
import React, { createContext, useContext, useState } from "react";
import { Group, Member, Expense, Balance } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/components/ui/use-toast";

interface GroupContextType {
  groups: Group[];
  currentGroup: Group | null;
  createGroup: (name: string) => void;
  selectGroup: (id: string) => void;
  addMember: (nameInput: string) => void;
  addExpense: (expense: Omit<Expense, "id">) => void;
  calculateBalances: () => Balance[];
  markBalanceAsPaid: (balance: Balance) => void;
  clearPaidBalances: () => void;
  paidBalances: Balance[];
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export const GroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [paidBalances, setPaidBalances] = useState<Balance[]>([]);
  const { toast } = useToast();

  const currentGroup = groups.find(g => g.id === currentGroupId) || null;

  const createGroup = (name: string) => {
    const newGroup: Group = {
      id: uuidv4(),
      name,
      members: [],
      expenses: []
    };
    
    setGroups([...groups, newGroup]);
    setCurrentGroupId(newGroup.id);
    toast({
      title: "Group created",
      description: `${name} has been created successfully.`,
    });
  };

  const selectGroup = (id: string) => {
    setCurrentGroupId(id);
    // Clear paid balances when switching groups
    setPaidBalances([]);
  };

  const addMember = (nameInput: string) => {
    if (!currentGroup) return;
    
    // Split by comma and process each name
    const names = nameInput.split(',').map(name => name.trim()).filter(name => name !== '');
    
    if (names.length === 0) return;
    
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

  const addExpense = (expenseData: Omit<Expense, "id">) => {
    if (!currentGroup) return;
    
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

  const calculateBalances = (): Balance[] => {
    if (!currentGroup) return [];

    // Calculate how much each person has spent and owes
    const memberBalances: Record<string, number> = {};
    
    // Initialize all members with zero balance
    currentGroup.members.forEach(member => {
      memberBalances[member.id] = 0;
    });

    // Process all expenses
    currentGroup.expenses.forEach(expense => {
      // Add the full amount to the person who paid
      memberBalances[expense.paidBy] += expense.amount;
      
      // Calculate per-person share and subtract from participants
      const perPersonAmount = expense.amount / expense.participants.length;
      expense.participants.forEach(participantId => {
        memberBalances[participantId] -= perPersonAmount;
      });
    });

    // Convert to a list of transactions
    const balances: Balance[] = [];
    const debtors = currentGroup.members.filter(m => memberBalances[m.id] < 0);
    const creditors = currentGroup.members.filter(m => memberBalances[m.id] > 0);
    
    debtors.forEach(debtor => {
      let remainingDebt = Math.abs(memberBalances[debtor.id]);
      
      for (const creditor of creditors) {
        if (memberBalances[creditor.id] <= 0) continue;
        
        const paymentAmount = Math.min(remainingDebt, memberBalances[creditor.id]);
        if (paymentAmount > 0.01) { // Ignore tiny amounts
          // Round up to the nearest 1000 đồng
          const roundedAmount = Math.ceil(paymentAmount / 1000) * 1000;
          
          balances.push({
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

    // Filter out balances that have been marked as paid
    return balances.filter(balance => 
      !paidBalances.some(paid => 
        paid.from === balance.from && 
        paid.to === balance.to && 
        paid.amount === balance.amount
      )
    );
  };

  const markBalanceAsPaid = (balance: Balance) => {
    setPaidBalances([...paidBalances, balance]);
    
    // Log the transaction as paid
    console.log(`Transaction marked as paid: ${balance.amount.toLocaleString('vi-VN')} đ from ${
      currentGroup?.members.find(m => m.id === balance.from)?.name
    } to ${
      currentGroup?.members.find(m => m.id === balance.to)?.name
    }`);
    
    toast({
      title: "Transaction marked as paid",
      description: `${balance.amount.toLocaleString('vi-VN')} đ has been marked as paid.`,
    });
  };

  const clearPaidBalances = () => {
    const count = paidBalances.length;
    setPaidBalances([]);
    
    toast({
      title: "Paid transactions cleared",
      description: `${count} transaction${count !== 1 ? 's' : ''} cleared successfully.`,
    });
  };

  return (
    <GroupContext.Provider value={{
      groups,
      currentGroup,
      createGroup,
      selectGroup,
      addMember,
      addExpense,
      calculateBalances,
      markBalanceAsPaid,
      clearPaidBalances,
      paidBalances
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
