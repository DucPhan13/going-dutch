import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/components/ui/use-toast";
import { Group, Member, Expense, Balance, Transaction } from "@/types";
import { GroupSyncRepository } from "@/sync/repository";
import type { ExportGroupArchiveResult, ImportGroupArchiveResult } from "@/sync/types";
import { NearbySyncSession, readNearbyPairingFragment, type NearbySyncState } from "@/sync/nearby";
import { CloudTransferSession, readCloudPairingFragment, type CloudSyncState } from "@/sync/cloud";

interface GroupContextType {
  groups: Group[];
  currentGroup: Group | null;
  isLoading: boolean;
  syncError: string | null;
  nearbySync: NearbySyncState;
  pendingNearbyOffer?: string;
  cloudSync: CloudSyncState;
  cloudTransferAvailable: boolean;
  pendingCloudPair?: string;
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
  exportGroupArchive: (groupId: string, passphrase: string) => Promise<ExportGroupArchiveResult>;
  importGroupArchive: (file: Blob, passphrase: string) => Promise<ImportGroupArchiveResult>;
  createNearbyOffer: (groupId: string) => Promise<string>;
  acceptNearbyOffer: (code: string) => Promise<void>;
  beginNearbyJoin: (code: string) => void;
  cancelNearbySync: () => void;
  clearPendingNearbyOffer: () => void;
  createCloudTransfer: (groupId: string) => Promise<string>;
  joinCloudTransfer: (code: string) => Promise<void>;
  cancelCloudTransfer: () => void;
  clearPendingCloudPair: () => void;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);
const repository = new GroupSyncRepository();

export const GroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [nearbySync, setNearbySync] = useState<NearbySyncState>({ status: "idle", detail: "Ready to sync a nearby device." });
  const [pendingNearbyOffer, setPendingNearbyOffer] = useState<string>();
  const nearbyClient = useRef<NearbySyncSession | null>(null);
  const [cloudSync, setCloudSync] = useState<CloudSyncState>({ status: "idle", detail: "Cloud transfer is ready when needed." });
  const [pendingCloudPair, setPendingCloudPair] = useState<string>();
  const cloudClient = useRef<CloudTransferSession | null>(null);
  const { toast } = useToast();

  const refreshGroups = useCallback(() => setGroups(repository.listGroups()), []);

  useEffect(() => {
    let mounted = true;
    void repository.initialise()
      .then(async () => {
        if (!mounted) return;
        refreshGroups();
        const client = new NearbySyncSession(repository, {
          onState: state => { if (mounted) setNearbySync(state); },
          onRemoteGroup: () => { if (mounted) refreshGroups(); },
        });
        nearbyClient.current = client;
        const cloud = new CloudTransferSession(repository, {
          onState: state => { if (mounted) setCloudSync(state); },
          onRemoteGroup: () => { if (mounted) refreshGroups(); },
        });
        cloudClient.current = cloud;
        try {
          const offer = await readNearbyPairingFragment();
          if (mounted && offer) setPendingNearbyOffer(offer);
        } catch {
          if (mounted) setNearbySync({ status: "failed", detail: "This nearby pairing link is invalid or expired." });
        }
        const cloudPair = readCloudPairingFragment();
        if (mounted && cloudPair) setPendingCloudPair(cloudPair);
      })
      .catch(error => {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : "Offline storage could not be opened.";
        setSyncError(message);
        toast({ title: "Data storage unavailable", description: message, variant: "destructive" });
      })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => {
      mounted = false;
      nearbyClient.current?.cancel();
      nearbyClient.current = null;
      cloudClient.current?.cancel();
      cloudClient.current = null;
    };
  }, [refreshGroups, toast]);

  const currentGroup = useMemo(() => groups.find(group => group.id === currentGroupId) || null, [groups, currentGroupId]);

  const run = useCallback((operation: Promise<unknown>, success?: { title: string; description: string }) => {
    void operation.then(() => {
      refreshGroups();
      if (success) toast(success);
    }).catch(error => {
      const message = error instanceof Error ? error.message : "Unable to save this change.";
      setSyncError(message);
      toast({ title: "Could not save", description: message, variant: "destructive" });
    });
  }, [refreshGroups, toast]);

  const createGroup = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return toast({ title: "Error", description: "Group name cannot be empty.", variant: "destructive" });
    const id = uuidv4();
    setCurrentGroupId(id);
    run(repository.createGroup(id, trimmed), { title: "Group created", description: `${trimmed} has been created successfully.` });
  };

  const selectGroup = useCallback((id: string) => setCurrentGroupId(id), []);

  const addMember = (nameInput: string) => {
    if (!currentGroup) return toast({ title: "Error", description: "No group selected.", variant: "destructive" });
    const names = nameInput.split(",").map(name => name.trim()).filter(Boolean);
    if (!names.length) return toast({ title: "Error", description: "No valid names provided.", variant: "destructive" });
    const members: Member[] = names.map(name => ({ id: uuidv4(), name }));
    run(repository.addMembers(currentGroup.id, members), {
      title: names.length > 1 ? "Members added" : "Member added",
      description: names.length > 1 ? `${names.length} members have been added to ${currentGroup.name}.` : `${names[0]} has been added to ${currentGroup.name}.`,
    });
  };

  const addMemberToGroup = (groupId: string, name: string) => {
    const trimmed = name.trim();
    const group = groups.find(item => item.id === groupId);
    if (!trimmed || !group) return;
    run(repository.addMembers(groupId, [{ id: uuidv4(), name: trimmed }]), { title: "Friend added", description: `${trimmed} was added to ${group.name}.` });
  };

  const editMember = (id: string, name: string) => {
    if (!currentGroup) return toast({ title: "Error", description: "No group selected.", variant: "destructive" });
    const trimmed = name.trim();
    if (!trimmed) return toast({ title: "Error", description: "Member name cannot be empty.", variant: "destructive" });
    run(repository.editMember(currentGroup.id, id, trimmed), { title: "Member updated", description: `The member has been updated to "${trimmed}".` });
  };

  const removeMember = (id: string) => {
    if (!currentGroup) return toast({ title: "Error", description: "No group selected.", variant: "destructive" });
    if (currentGroup.expenses.some(expense => expense.paidBy === id || expense.participants.includes(id))) {
      return toast({ title: "Cannot remove member", description: "This member is part of one or more expenses. Edit the expenses first.", variant: "destructive" });
    }
    const name = currentGroup.members.find(member => member.id === id)?.name || "Member";
    run(repository.removeMember(currentGroup.id, id), { title: "Member removed", description: `${name} has been removed from ${currentGroup.name}.` });
  };

  const addExpense = (expenseData: Omit<Expense, "id">) => {
    if (!currentGroup) return toast({ title: "Error", description: "No group selected.", variant: "destructive" });
    if (expenseData.amount <= 0) return toast({ title: "Error", description: "Expense amount must be positive.", variant: "destructive" });
    const expense: Expense = { id: uuidv4(), ...expenseData };
    run(repository.addExpense(currentGroup.id, expense), { title: "Expense added", description: `${expense.description} (${expense.amount.toFixed(2)}) has been added.` });
  };

  const editExpense = (id: string, expenseData: Omit<Expense, "id">) => {
    if (!currentGroup) return toast({ title: "Error", description: "No group selected.", variant: "destructive" });
    if (expenseData.amount <= 0) return toast({ title: "Error", description: "Expense amount must be positive.", variant: "destructive" });
    run(repository.editExpense(currentGroup.id, id, expenseData), { title: "Expense updated", description: `${expenseData.description} (${expenseData.amount.toFixed(2)}) has been updated.` });
  };

  const removeExpense = (id: string) => {
    if (!currentGroup) return toast({ title: "Error", description: "No group selected.", variant: "destructive" });
    const expense = currentGroup.expenses.find(item => item.id === id);
    if (!expense) return toast({ title: "Error", description: "Expense not found.", variant: "destructive" });
    run(repository.removeExpense(currentGroup.id, id), { title: "Expense removed", description: `${expense.description} (${expense.amount.toFixed(2)}) has been removed.` });
  };

  const calculateBalances = useCallback((): Balance[] => {
    if (!currentGroup) return [];
    const memberBalances: Record<string, number> = Object.fromEntries(currentGroup.members.map(member => [member.id, 0]));
    currentGroup.expenses.forEach(expense => {
      memberBalances[expense.paidBy] += expense.amount;
      const values = expense.splitValues || {};
      const totalValue = expense.participants.reduce((sum, id) => sum + (values[id] || 0), 0);
      expense.participants.forEach(participantId => {
        let share = expense.amount / expense.participants.length;
        if (expense.splitType === "exact") share = values[participantId] || 0;
        if (expense.splitType === "percentage" || expense.splitType === "shares" || expense.splitType === "unequal") share = totalValue > 0 ? expense.amount * ((values[participantId] || 0) / totalValue) : share;
        memberBalances[participantId] -= share;
      });
    });
    const balances: Balance[] = [];
    const debtors = currentGroup.members.filter(member => memberBalances[member.id] < -0.01);
    const creditors = currentGroup.members.filter(member => memberBalances[member.id] > 0.01);
    debtors.forEach(debtor => {
      let remainingDebt = Math.abs(memberBalances[debtor.id]);
      for (const creditor of creditors) {
        if (memberBalances[creditor.id] <= 0.01) continue;
        const paymentAmount = Math.min(remainingDebt, memberBalances[creditor.id]);
        if (paymentAmount > 0.01) {
          const roundedAmount = Math.ceil(paymentAmount / 1000) * 1000;
          balances.push({ id: uuidv4(), from: debtor.id, to: creditor.id, amount: roundedAmount });
          remainingDebt -= paymentAmount;
          memberBalances[creditor.id] -= paymentAmount;
        }
        if (remainingDebt < 0.01) break;
      }
    });
    return balances.filter(balance => !currentGroup.transactions.some(tx => tx.originalBalanceId === balance.id || (tx.from === balance.from && tx.to === balance.to && Math.abs(tx.amount - balance.amount) < 1000)));
  }, [currentGroup]);

  const markBalanceAsPaid = (balance: Balance, paymentMethod = "Cash") => {
    if (!currentGroup) return toast({ title: "Error", description: "No group selected.", variant: "destructive" });
    if (!currentGroup.members.some(member => member.id === balance.from) || !currentGroup.members.some(member => member.id === balance.to) || balance.amount <= 0) {
      return toast({ title: "Error", description: "Invalid balance.", variant: "destructive" });
    }
    if (currentGroup.transactions.some(transaction => transaction.originalBalanceId === balance.id)) return toast({ title: "Error", description: "This balance has already been recorded as a transaction.", variant: "destructive" });
    const transaction: Transaction = { id: uuidv4(), from: balance.from, to: balance.to, amount: balance.amount, paidAt: new Date().toISOString(), originalBalanceId: balance.id, paymentMethod };
    run(repository.addTransaction(currentGroup.id, transaction), { title: "Transaction created", description: `${balance.amount.toLocaleString("vi-VN")} đ has been recorded.` });
  };

  const clearTransactions = () => {
    if (!currentGroup) return toast({ title: "Error", description: "No group selected.", variant: "destructive" });
    const count = currentGroup.transactions.length;
    run(repository.clearTransactions(currentGroup.id), { title: "Transaction history cleared", description: `${count} transaction${count !== 1 ? "s" : ""} cleared successfully.` });
  };

  const exportGroupArchive = useCallback((groupId: string, passphrase: string) => repository.exportGroupArchive(groupId, passphrase), []);
  const importGroupArchive = useCallback(async (file: Blob, passphrase: string) => {
    const result = await repository.importGroupArchive(file, passphrase);
    refreshGroups();
    setCurrentGroupId(result.groupId);
    return result;
  }, [refreshGroups]);
  const createNearbyOffer = useCallback((groupId: string) => nearbyClient.current?.createOffer(groupId) ?? Promise.reject(new Error("Nearby sync is still loading.")), []);
  const acceptNearbyOffer = useCallback((code: string) => nearbyClient.current?.acceptOffer(code) ?? Promise.reject(new Error("Nearby sync is still loading.")), []);
  const beginNearbyJoin = useCallback((code: string) => {
    const value = code.replace(/\D/g, "").slice(0, 6);
    if (/^\d{6}$/.test(value)) setPendingNearbyOffer(value);
  }, []);
  const cancelNearbySync = useCallback(() => nearbyClient.current?.cancel(), []);
  const clearPendingNearbyOffer = useCallback(() => setPendingNearbyOffer(undefined), []);
  const createCloudTransfer = useCallback((groupId: string) => cloudClient.current?.create(groupId) ?? Promise.reject(new Error("Cloud transfer is still loading.")), []);
  const joinCloudTransfer = useCallback((code: string) => cloudClient.current?.join(code) ?? Promise.reject(new Error("Cloud transfer is still loading.")), []);
  const cancelCloudTransfer = useCallback(() => cloudClient.current?.cancel(), []);
  const clearPendingCloudPair = useCallback(() => setPendingCloudPair(undefined), []);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground" role="status" aria-live="polite">
        <div>
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-border border-t-emerald-400" />
          <p className="font-medium">Opening your offline data…</p>
          <p className="mt-1 text-sm text-muted-foreground">Existing groups stay on this device.</p>
        </div>
      </div>
    );
  }

  if (syncError && !repository.isReady()) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
        <div className="app-surface max-w-md p-6">
          <h1 className="text-xl font-semibold">Offline storage could not be opened</h1>
          <p className="mt-2 text-sm text-muted-foreground">{syncError}</p>
          <p className="mt-4 text-sm text-muted-foreground">Your previous browser data was left unchanged. Reload the app or check that private browsing allows IndexedDB.</p>
        </div>
      </div>
    );
  }

  return <GroupContext.Provider value={{ groups, currentGroup, isLoading, syncError, nearbySync, pendingNearbyOffer, cloudSync, cloudTransferAvailable: Boolean(import.meta.env.VITE_CLOUD_SYNC_URL), pendingCloudPair, createGroup, selectGroup, addMember, addMemberToGroup, editMember, removeMember, addExpense, editExpense, removeExpense, calculateBalances, markBalanceAsPaid, clearTransactions, exportGroupArchive, importGroupArchive, createNearbyOffer, acceptNearbyOffer, beginNearbyJoin, cancelNearbySync, clearPendingNearbyOffer, createCloudTransfer, joinCloudTransfer, cancelCloudTransfer, clearPendingCloudPair }}>{children}</GroupContext.Provider>;
};

export const useGroupContext = () => {
  const context = useContext(GroupContext);
  if (!context) throw new Error("useGroupContext must be used within a GroupProvider");
  return context;
};
