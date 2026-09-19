import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useGroupContext } from '@/contexts/GroupContext';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ExpenseCard from '@/components/expenses/ExpenseCard';
import BalancesList from '@/components/balances/BalancesList';
import TransactionList from '@/components/balances/TransactionList';
import OfflineSyncDialog from '@/components/sync/OfflineSyncDialog';
import Avatar from '@/components/ui/avatar';
import { Plus, Edit2, Trash2, UserPlus, ReceiptText, WalletCards, HardDrive } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { usePreferences } from '@/contexts/PreferencesContext';

const GroupDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    selectGroup,
    currentGroup,
    removeGroup,
    addMember,
    editMember,
    removeMember,
    removeExpense,
    calculateBalances,
  } = useGroupContext();
  const { toast } = useToast();
  const { t, formatVnd } = usePreferences();

  const [newMemberName, setNewMemberName] = useState('');
  const [activeTab, setActiveTab] = useState('expenses');
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<{ id: string; name: string } | null>(null);
  const [editedMemberName, setEditedMemberName] = useState('');

  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [deleteItemType, setDeleteItemType] = useState<'group' | 'member' | 'expense' | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deleteItemName, setDeleteItemName] = useState('');

  useEffect(() => {
    if (id) {
      selectGroup(id);
    }
  }, [id, selectGroup]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get('view') === 'balances') {
      setActiveTab('balances');
    }
  }, [location.search]);

  if (!currentGroup) {
    return (
      <Layout title={t('groupNotFound')} showBack>
        <div className="empty-state">
          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
            <ReceiptText className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2 text-foreground">{t('groupNotFound')}</h2>
          <p className="text-muted-foreground mb-6">{t('groupMissing')}</p>
          <Button onClick={() => navigate('/')} variant="outline">
            {t('dashboard')}
          </Button>
        </div>
      </Layout>
    );
  }

  const totalExpenses = currentGroup.expenses.reduce((sum, e) => sum + e.amount, 0);
  const balances = calculateBalances();
  const outstandingBalances = balances.reduce((sum, b) => sum + b.amount, 0);

  const openEditMemberDialog = (member: { id: string; name: string }) => {
    setEditingMember(member);
    setEditedMemberName(member.name);
    setEditMemberDialogOpen(true);
  };

  const handleEditMember = () => {
    if (editingMember && editedMemberName.trim()) {
      editMember(editingMember.id, editedMemberName.trim());
      setEditMemberDialogOpen(false);
      setEditingMember(null);
    }
  };

  const openDeleteConfirmDialog = (type: 'group' | 'member' | 'expense', id: string, name: string) => {
    setDeleteItemType(type);
    setDeleteItemId(id);
    setDeleteItemName(name);
    setDeleteConfirmDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItemId || !deleteItemType) return;
    if (deleteItemType === 'group') {
      const removed = await removeGroup(deleteItemId);
      if (removed) navigate('/');
    } else if (deleteItemType === 'member') {
      removeMember(deleteItemId);
    } else if (deleteItemType === 'expense') {
      removeExpense(deleteItemId);
    }
    setDeleteConfirmDialogOpen(false);
    setDeleteItemId(null);
    setDeleteItemType(null);
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMemberName.trim()) {
      addMember(newMemberName.trim());
      setNewMemberName('');
    }
  };

  return (
    <Layout title={currentGroup.name} showBack>
      <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="section-label mb-1">{t('groupWorkspace')}</p><h2 className="text-2xl font-semibold tracking-tight">{currentGroup.name}</h2></div>
        <div className="flex shrink-0 self-end gap-2 sm:self-auto">
          <Button onClick={() => setSyncDialogOpen(true)} variant="outline" className="gap-2 border-border" aria-label={t('sync')}><HardDrive className="h-4 w-4" /><span className="hidden sm:inline">{t('sync')}</span></Button>
          <Button onClick={() => navigate(`/group/${currentGroup.id}/settle-up`)} variant="outline" className="gap-2 border-border" aria-label={t('settleUp')}><WalletCards className="h-4 w-4" /><span className="hidden sm:inline">{t('settleUp')}</span></Button>
          <Button onClick={() => openDeleteConfirmDialog('group', currentGroup.id, currentGroup.name)} variant="outline" className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`${t('remove')} ${currentGroup.name}`}><Trash2 className="h-4 w-4" /><span className="hidden sm:inline">{t('remove')}</span></Button>
        </div>
      </div>
      <section className="app-surface mb-6 overflow-hidden" aria-label={t('groupWorkspace')}>
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <p className="section-label mb-2">{t('totalSpent')}</p>
            <p className="amount text-3xl font-semibold tracking-tight text-foreground">{formatVnd(totalExpenses)}</p>
          </div>
          <p className="text-sm text-muted-foreground">{t('expenseCount', { count: currentGroup.expenses.length })}</p>
        </div>
        <dl className="grid grid-cols-1 divide-y divide-border border-t border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="min-w-0 px-5 py-4 sm:px-6">
            <dt className="section-label mb-2">{t('members')}</dt>
            <dd className="flex items-center gap-2 text-xl font-semibold text-foreground">
              {currentGroup.members.length}
              <span className="flex -space-x-1.5" aria-label={t('members')}>
                {currentGroup.members.slice(0, 3).map((member) => (
                  <Avatar key={member.id} name={member.name} className="h-5 w-5 border border-background text-xs" />
                ))}
              </span>
            </dd>
          </div>
          <div className="min-w-0 px-5 py-4 sm:px-6">
            <dt className="section-label mb-2">{t('owed')}</dt>
            <dd className={`amount text-xl font-semibold ${outstandingBalances > 0 ? 'balance-negative' : 'balance-positive'}`}>
              {outstandingBalances > 0 ? formatVnd(outstandingBalances) : t('allSettled')}
            </dd>
          </div>
        </dl>
      </section>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="expenses">{t('expenses')}</TabsTrigger>
          <TabsTrigger value="members">{t('members')}</TabsTrigger>
          <TabsTrigger value="balances">{t('balances')}</TabsTrigger>
        </TabsList>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          {currentGroup.members.length === 0 ? (
            <section className="app-surface px-6 py-10 text-center sm:px-10" aria-labelledby="onboarding-members-title">
              <div className="icon-tile mx-auto mb-5 grid h-12 w-12 place-items-center">
                <UserPlus className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 id="onboarding-members-title" className="text-xl font-semibold">{t('onboardingMembersTitle')}</h3>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">{t('onboardingMembersBody')}</p>
              <Button onClick={() => setActiveTab('members')} className="app-button-primary mt-6 gap-2">
                <UserPlus className="h-4 w-4" /> {t('onboardingMembersAction')}
              </Button>
            </section>
          ) : currentGroup.expenses.length > 0 ? (
            <div className="space-y-3">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold">{t('expenseCount', { count: currentGroup.expenses.length })}</h3>
                <Button
                  onClick={() => navigate(`/group/${currentGroup.id}/add-expense`)}
                  className="app-button-primary gap-2 active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" /> {t('addExpense')}
                </Button>
              </div>
              {currentGroup.expenses.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  members={currentGroup.members}
                  onEdit={() => navigate(`/group/${currentGroup.id}/add-expense?edit=${expense.id}`)}
                  onDelete={() => openDeleteConfirmDialog('expense', expense.id, expense.description)}
                />
              ))}
            </div>
          ) : (
            <section className="app-surface px-6 py-10 text-center sm:px-10" aria-labelledby="onboarding-expense-title">
              <div className="icon-tile mx-auto mb-5 grid h-12 w-12 place-items-center">
                <ReceiptText className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 id="onboarding-expense-title" className="text-xl font-semibold">{t('onboardingExpenseTitle')}</h3>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">{t('onboardingExpenseBody')}</p>
              <Button onClick={() => navigate(`/group/${currentGroup.id}/add-expense`)} className="app-button-primary mt-6 gap-2 active:scale-[0.98]">
                <Plus className="h-4 w-4" /> {t('addFirstExpense')}
              </Button>
            </section>
          )}
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card className="bento-tile mb-6 !p-4">
            <form onSubmit={handleAddMember} className="flex gap-2">
              <Input
                placeholder={t('addMemberPlaceholder')}
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" className="app-button-primary active:scale-[0.98]">
                <Plus className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{t('add')}</span>
              </Button>
            </form>
          </Card>

          {currentGroup.members.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentGroup.members.map((member) => (
                <div
                  key={member.id}
                  className="bento-tile flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={member.name} className="w-10 h-10 text-sm" />
                    <span className="font-medium text-foreground truncate">{member.name}</span>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 hover:bg-accent text-muted-foreground hover:text-foreground"
                      onClick={() => openEditMemberDialog(member)}
                      aria-label={t('editMemberLabel', { name: member.name })}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => openDeleteConfirmDialog('member', member.id, member.name)}
                      aria-label={t('deleteMember', { name: member.name })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              {t('noMembersYet')}
            </div>
          )}
        </TabsContent>

        {/* Balances Tab */}
        <TabsContent value="balances">
          {currentGroup.expenses.length > 0 ? (
            <>
              {new URLSearchParams(location.search).get('view') === 'balances' && (
                <section className="app-surface-strong mb-4 px-5 py-4" aria-labelledby="onboarding-balance-title">
                  <h3 id="onboarding-balance-title" className="text-xl font-semibold">{t('onboardingBalanceTitle')}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t('onboardingBalanceBody')}</p>
                </section>
              )}
              <BalancesList balances={balances} />
              <TransactionList />
            </>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              {t('balancesEmpty')}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Member Dialog */}
      <Dialog open={editMemberDialogOpen} onOpenChange={setEditMemberDialogOpen}>
        <DialogContent className="bento-tile !p-6">
          <DialogHeader>
            <DialogTitle>{t('editMember')}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder={t('member')}
              value={editedMemberName}
              onChange={(e) => setEditedMemberName(e.target.value)}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMemberDialogOpen(false)}>{t('cancel')}</Button>
            <Button className="app-button-primary" onClick={handleEditMember}>{t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirmDialogOpen} onOpenChange={setDeleteConfirmDialogOpen}>
        <DialogContent className="bento-tile !p-6">
          <DialogHeader>
            <DialogTitle>{deleteItemType === 'group' ? t('deleteGroupTitle') : deleteItemType === 'member' ? t('deleteMemberTitle', { name: deleteItemName }) : t('deleteExpenseTitle', { description: deleteItemName })}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-foreground">{deleteItemType === 'group' ? t('deleteGroupBody', { groupName: deleteItemName }) : deleteItemType === 'member' ? t('deleteMemberBody', { name: deleteItemName }) : t('deleteExpenseBody')}</p>
            {deleteItemType === 'member' && (
              <p className="text-sm text-muted-foreground mt-2">
                {t('memberDeleteWarning')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmDialogOpen(false)}>{t('cancel')}</Button>
            <Button variant="destructive" onClick={() => void handleDeleteConfirm()}>
              {deleteItemType === 'group' ? t('removeGroup') : deleteItemType === 'member' ? t('removeMember') : t('deleteExpense')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OfflineSyncDialog
        groupId={currentGroup.id}
        groupName={currentGroup.name}
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
      />
      </div>
    </Layout>
  );
};

export default GroupDetail;
