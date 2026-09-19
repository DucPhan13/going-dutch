import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Group, Member, Expense, Balance, Transaction } from "@/types";
import { GroupSyncRepository } from "@/sync/repository";
import type { ExportGroupArchiveResult, ImportGroupArchiveResult } from "@/sync/types";
import { NearbySyncSession, readNearbyPairingFragment, type NearbySyncState } from "@/sync/nearby";
import { CloudTransferSession, readCloudPairingFragment, type CloudSyncState } from "@/sync/cloud";
import { parseVndAmount } from "@/lib/money";
import { calculateSettlementBalances } from "@/lib/balances";
import { usePreferences } from "@/contexts/PreferencesContext";

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
  createGroup: (name: string, memberNames?: string[]) => void;
  removeGroup: (groupId: string) => Promise<boolean>;
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
  clearTransactions: () => Promise<boolean>;
  undoClearTransactions: () => void;
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

function normaliseExpenseAmount(expense: Omit<Expense, "id">): Omit<Expense, "id"> | null {
  const amount = parseVndAmount(expense.amount);
  return amount === null ? null : { ...expense, amount };
}

export const GroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, formatVnd } = usePreferences();
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [nearbySync, setNearbySync] = useState<NearbySyncState>({ status: "idle", detail: "" });
  const [pendingNearbyOffer, setPendingNearbyOffer] = useState<string>();
  const nearbyClient = useRef<NearbySyncSession | null>(null);
  const [cloudSync, setCloudSync] = useState<CloudSyncState>({ status: "idle", detail: "" });
  const [pendingCloudPair, setPendingCloudPair] = useState<string>();
  const cloudClient = useRef<CloudTransferSession | null>(null);
  const lastClearedTransactions = useRef<{ groupId: string; transactionIds: string[]; expiresAt: number }>();
  const lastRecordedPayment = useRef<{ groupId: string; transactionId: string; amount: number; expiresAt: number }>();
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
          if (mounted) setNearbySync({ status: "failed", detail: t('nearbyLinkInvalid') });
        }
        const cloudPair = readCloudPairingFragment();
        if (mounted && cloudPair) setPendingCloudPair(cloudPair);
      })
      .catch(error => {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : t('storageUnavailable');
        setSyncError(message);
        toast({ title: t('storageUnavailable'), description: message, variant: "destructive" });
      })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => {
      mounted = false;
      nearbyClient.current?.cancel();
      nearbyClient.current = null;
      cloudClient.current?.cancel();
      cloudClient.current = null;
    };
  }, [refreshGroups, t, toast]);

  const currentGroup = useMemo(() => groups.find(group => group.id === currentGroupId) || null, [groups, currentGroupId]);

  const run = useCallback((operation: Promise<unknown>, success?: { title: string; description: string; action?: React.ReactElement; duration?: number }, onSuccess?: () => void) => {
    void operation.then(() => {
      refreshGroups();
      onSuccess?.();
      if (success) toast(success);
    }).catch(error => {
      const message = error instanceof Error ? error.message : t('saveFailed');
      setSyncError(message);
      toast({ title: t('couldNotSave'), description: message, variant: "destructive" });
    });
  }, [refreshGroups, t, toast]);

  const createGroup = (name: string, memberNames: string[] = []) => {
    const trimmed = name.trim();
    if (!trimmed) return toast({ title: t('error'), description: t('groupNameEmpty'), variant: "destructive" });
    const seenNames = new Set<string>();
    const members: Member[] = memberNames.reduce<Member[]>((collected, memberName) => {
      const normalizedName = memberName.trim();
      const key = normalizedName.toLocaleLowerCase();
      if (!normalizedName || seenNames.has(key)) return collected;
      seenNames.add(key);
      collected.push({ id: uuidv4(), name: normalizedName });
      return collected;
    }, []);
    const id = uuidv4();
    setCurrentGroupId(id);
    run(repository.createGroup(id, trimmed, members), { title: t('groupCreated'), description: t('groupCreatedBody', { groupName: trimmed }) });
  };

  const removeGroup = async (groupId: string) => {
    const group = groups.find(item => item.id === groupId);
    if (!group) {
      toast({ title: t('groupNotFound'), description: t('groupUnavailable'), variant: "destructive" });
      return false;
    }
    try {
      await repository.removeGroup(groupId);
      if (currentGroupId === groupId) setCurrentGroupId(null);
      refreshGroups();
      toast({ title: t('groupRemoved'), description: t('groupRemovedBody', { groupName: group.name }) });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : t('removeGroupFailed');
      setSyncError(message);
      toast({ title: t('couldNotRemoveGroup'), description: message, variant: "destructive" });
      return false;
    }
  };

  const selectGroup = useCallback((id: string) => setCurrentGroupId(id), []);

  const addMember = (nameInput: string) => {
    if (!currentGroup) return toast({ title: t('error'), description: t('noGroupSelected'), variant: "destructive" });
    const names = nameInput.split(",").map(name => name.trim()).filter(Boolean);
    if (!names.length) return toast({ title: t('error'), description: t('noValidNames'), variant: "destructive" });
    const members: Member[] = names.map(name => ({ id: uuidv4(), name }));
    run(repository.addMembers(currentGroup.id, members), {
      title: names.length > 1 ? t('membersAdded') : t('memberAdded'),
      description: names.length > 1 ? t('membersAddedBody', { count: names.length, groupName: currentGroup.name }) : t('memberAddedBody', { name: names[0], groupName: currentGroup.name }),
    });
  };

  const addMemberToGroup = (groupId: string, name: string) => {
    const trimmed = name.trim();
    const group = groups.find(item => item.id === groupId);
    if (!trimmed || !group) return;
    run(repository.addMembers(groupId, [{ id: uuidv4(), name: trimmed }]), { title: t('friendAdded'), description: t('friendAddedBody', { name: trimmed, groupName: group.name }) });
  };

  const editMember = (id: string, name: string) => {
    if (!currentGroup) return toast({ title: t('error'), description: t('noGroupSelected'), variant: "destructive" });
    const trimmed = name.trim();
    if (!trimmed) return toast({ title: t('error'), description: t('memberNameEmpty'), variant: "destructive" });
    run(repository.editMember(currentGroup.id, id, trimmed), { title: t('memberUpdated'), description: t('memberUpdatedBody', { name: trimmed }) });
  };

  const removeMember = (id: string) => {
    if (!currentGroup) return toast({ title: t('error'), description: t('noGroupSelected'), variant: "destructive" });
    if (currentGroup.expenses.some(expense => expense.paidBy === id || expense.participants.includes(id))) {
      return toast({ title: t('cannotRemoveMember'), description: t('memberHasExpenses'), variant: "destructive" });
    }
    const name = currentGroup.members.find(member => member.id === id)?.name || t('member');
    run(repository.removeMember(currentGroup.id, id), { title: t('memberRemoved'), description: t('memberRemovedBody', { name, groupName: currentGroup.name }) });
  };

  const addExpense = (expenseData: Omit<Expense, "id">) => {
    if (!currentGroup) return toast({ title: t('error'), description: t('noGroupSelected'), variant: "destructive" });
    const expense = normaliseExpenseAmount(expenseData);
    if (!expense) return toast({ title: t('error'), description: t('expenseAmountInvalid'), variant: "destructive" });
    const savedExpense: Expense = { id: uuidv4(), ...expense };
    run(repository.addExpense(currentGroup.id, savedExpense), { title: t('expenseAdded'), description: t('expenseAddedBody', { description: savedExpense.description, amount: formatVnd(savedExpense.amount) }) });
  };

  const editExpense = (id: string, expenseData: Omit<Expense, "id">) => {
    if (!currentGroup) return toast({ title: t('error'), description: t('noGroupSelected'), variant: "destructive" });
    const expense = normaliseExpenseAmount(expenseData);
    if (!expense) return toast({ title: t('error'), description: t('expenseAmountInvalid'), variant: "destructive" });
    run(repository.editExpense(currentGroup.id, id, expense), { title: t('expenseUpdated'), description: t('expenseUpdatedBody', { description: expense.description, amount: formatVnd(expense.amount) }) });
  };

  const removeExpense = (id: string) => {
    if (!currentGroup) return toast({ title: t('error'), description: t('noGroupSelected'), variant: "destructive" });
    const expense = currentGroup.expenses.find(item => item.id === id);
    if (!expense) return toast({ title: t('error'), description: t('expenseNotFound'), variant: "destructive" });
    run(repository.removeExpense(currentGroup.id, id), { title: t('expenseRemoved'), description: t('expenseRemovedBody', { description: expense.description, amount: formatVnd(expense.amount) }) });
  };

  const calculateBalances = useCallback((): Balance[] => {
    return currentGroup ? calculateSettlementBalances(currentGroup) : [];
  }, [currentGroup]);

  const undoRecordedPayment = useCallback((payment: { groupId: string; transactionId: string; amount: number; expiresAt: number }) => {
    if (payment.expiresAt < Date.now()) return toast({ title: t('undoUnavailable'), description: t('undoExpired'), variant: "destructive" });
    if (lastRecordedPayment.current?.transactionId === payment.transactionId) lastRecordedPayment.current = undefined;
    run(repository.removeTransaction(payment.groupId, payment.transactionId), { title: t('paymentUndone'), description: t('paymentUndoneBody', { amount: formatVnd(payment.amount) }) });
  }, [formatVnd, run, t, toast]);

  const markBalanceAsPaid = (balance: Balance, paymentMethod = "cash") => {
    if (!currentGroup) return toast({ title: t('error'), description: t('noGroupSelected'), variant: "destructive" });
    if (!currentGroup.members.some(member => member.id === balance.from) || !currentGroup.members.some(member => member.id === balance.to) || balance.amount <= 0) {
      return toast({ title: t('error'), description: t('invalidBalance'), variant: "destructive" });
    }
    if (currentGroup.transactions.some(transaction => transaction.originalBalanceId === balance.id)) return toast({ title: t('error'), description: t('balanceAlreadyRecorded'), variant: "destructive" });
    const transaction: Transaction = { id: uuidv4(), from: balance.from, to: balance.to, amount: balance.amount, paidAt: new Date().toISOString(), originalBalanceId: balance.id, paymentMethod };
    const payment = { groupId: currentGroup.id, transactionId: transaction.id, amount: transaction.amount, expiresAt: Date.now() + 5_000 };
    run(repository.addTransaction(currentGroup.id, transaction), {
      title: t('paymentRecorded'),
      description: t('paymentRecordedBody', { amount: formatVnd(transaction.amount) }),
      duration: 5_000,
      action: <ToastAction altText={t('undo')} onClick={() => undoRecordedPayment(payment)}>{t('undo')}</ToastAction>,
    }, () => { lastRecordedPayment.current = payment; });
  };

  const clearTransactions = async () => {
    if (!currentGroup) {
      toast({ title: t('error'), description: t('noGroupSelected'), variant: "destructive" });
      return false;
    }
    const count = currentGroup.transactions.length;
    const cleared = { groupId: currentGroup.id, transactionIds: currentGroup.transactions.map(transaction => transaction.id), expiresAt: Date.now() + 10_000 };
    try {
      await repository.clearTransactions(currentGroup.id);
      lastClearedTransactions.current = cleared;
      refreshGroups();
      toast({ title: t('transactionHistoryCleared'), description: t('transactionHistoryClearedBody', { count }) });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : t('clearPaymentsFailed');
      setSyncError(message);
      toast({ title: t('couldNotClearPayments'), description: message, variant: "destructive" });
      return false;
    }
  };

  const undoClearTransactions = () => {
    const cleared = lastClearedTransactions.current;
    if (!cleared || cleared.expiresAt < Date.now()) return toast({ title: t('undoUnavailable'), description: t('undoExpired'), variant: "destructive" });
    lastClearedTransactions.current = undefined;
    run(repository.restoreTransactions(cleared.groupId, cleared.transactionIds), { title: t('paymentsRestored'), description: t('paymentsRestoredBody') });
  };

  const exportGroupArchive = useCallback((groupId: string, passphrase: string) => repository.exportGroupArchive(groupId, passphrase), []);
  const importGroupArchive = useCallback(async (file: Blob, passphrase: string) => {
    const result = await repository.importGroupArchive(file, passphrase);
    refreshGroups();
    setCurrentGroupId(result.groupId);
    return result;
  }, [refreshGroups]);
  const createNearbyOffer = useCallback((groupId: string) => nearbyClient.current?.createOffer(groupId) ?? Promise.reject(new Error(t('nearbyLoading'))), [t]);
  const acceptNearbyOffer = useCallback((code: string) => nearbyClient.current?.acceptOffer(code) ?? Promise.reject(new Error(t('nearbyLoading'))), [t]);
  const beginNearbyJoin = useCallback((code: string) => {
    const value = code.replace(/\D/g, "").slice(0, 6);
    if (/^\d{6}$/.test(value)) setPendingNearbyOffer(value);
  }, []);
  const cancelNearbySync = useCallback(() => nearbyClient.current?.cancel(), []);
  const clearPendingNearbyOffer = useCallback(() => setPendingNearbyOffer(undefined), []);
  const createCloudTransfer = useCallback((groupId: string) => cloudClient.current?.create(groupId) ?? Promise.reject(new Error(t('cloudLoading'))), [t]);
  const joinCloudTransfer = useCallback((code: string) => cloudClient.current?.join(code) ?? Promise.reject(new Error(t('cloudLoading'))), [t]);
  const cancelCloudTransfer = useCallback(() => cloudClient.current?.cancel(), []);
  const clearPendingCloudPair = useCallback(() => setPendingCloudPair(undefined), []);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground" role="status" aria-live="polite">
        <div>
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-border border-t-emerald-400" />
          <p className="font-medium">{t('openingData')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('openingDataHelp')}</p>
        </div>
      </div>
    );
  }

  if (syncError && !repository.isReady()) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
        <div className="app-surface max-w-md p-6">
          <h1 className="text-xl font-semibold">{t('storageUnavailable')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{syncError}</p>
          <p className="mt-4 text-sm text-muted-foreground">{t('storageUnavailableHelp')}</p>
        </div>
      </div>
    );
  }

  return <GroupContext.Provider value={{ groups, currentGroup, isLoading, syncError, nearbySync, pendingNearbyOffer, cloudSync, cloudTransferAvailable: Boolean(import.meta.env.VITE_CLOUD_SYNC_URL), pendingCloudPair, createGroup, removeGroup, selectGroup, addMember, addMemberToGroup, editMember, removeMember, addExpense, editExpense, removeExpense, calculateBalances, markBalanceAsPaid, clearTransactions, undoClearTransactions, exportGroupArchive, importGroupArchive, createNearbyOffer, acceptNearbyOffer, beginNearbyJoin, cancelNearbySync, clearPendingNearbyOffer, createCloudTransfer, joinCloudTransfer, cancelCloudTransfer, clearPendingCloudPair }}>{children}</GroupContext.Provider>;
};

export const useGroupContext = () => {
  const context = useContext(GroupContext);
  if (!context) throw new Error("useGroupContext must be used within a GroupProvider");
  return context;
};
