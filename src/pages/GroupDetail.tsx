import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
      <div className="mb-6 flex items-end justify-between gap-4">
        <div><p className="section-label mb-1">{t('groupWorkspace')}</p><h2 className="text-2xl font-semibold tracking-tight">{currentGroup.name}</h2></div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={() => setSyncDialogOpen(true)} variant="outline" className="gap-2 border-border"><HardDrive className="h-4 w-4" /><span className="hidden sm:inline">{t('sync')}</span></Button>
          <Button onClick={() => navigate(`/group/${currentGroup.id}/settle-up`)} variant="outline" className="gap-2 border-border"><WalletCards className="h-4 w-4" /><span className="hidden sm:inline">{t('settleUp')}</span></Button>
          <Button onClick={() => openDeleteConfirmDialog('group', currentGroup.id, currentGroup.name)} variant="outline" className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`${t('remove')} ${currentGroup.name}`}><Trash2 className="h-4 w-4" /><span className="hidden sm:inline">{t('remove')}</span></Button>
        </div>
      </div>
      <section className="app-surface mb-6 overflow-hidden" aria-label={t('groupWorkspace')}>
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <p className="section-label mb-2">{t('totalSpent')}</p>
            <p className="amount text-3xl font-semibold tracking-tight text-foreground">{formatVnd(totalExpenses)}</p>
          </div>
          <p className="text-sm text-muted-foreground">{currentGroup.expenses.length} expenses</p>
        </div>
        <dl className="grid grid-cols-2 divide-x divide-border border-t border-border">
          <div className="min-w-0 px-5 py-4 sm:px-6">
            <dt className="section-label mb-2">{t('members')}</dt>
            <dd className="flex items-center gap-2 text-xl font-semibold text-foreground">
              {currentGroup.members.length}
              <span className="flex -space-x-1.5" aria-label={t('members')}>
                {currentGroup.members.slice(0, 3).map((member) => (
                  <Avatar key={member.id} name={member.name} className="h-5 w-5 border border-background text-[9px]" />
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
            <div className="text-center py-10">
              <UserPlus className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">{t('addMembers')}.</p>
              <Button onClick={() => setActiveTab('members')} variant="outline">
                <UserPlus className="mr-2 h-4 w-4" /> {t('addMembers')}
              </Button>
            </div>
          ) : currentGroup.expenses.length > 0 ? (
            <div className="space-y-3">
              <div className="flex justify-end mb-2">
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
            <div className="text-center py-10">
              <ReceiptText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">{t('noExpensesYet')}</p>
              <Button
                onClick={() => navigate(`/group/${currentGroup.id}/add-expense`)}
                className="app-button-primary gap-2 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" /> {t('addFirstExpense')}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card className="bento-tile mb-6 !p-4">
            <form onSubmit={handleAddMember} className="flex gap-2">
              <Input
                placeholder="Add members, e.g. Minh, Lan, Tuan"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" className="app-button-primary active:scale-[0.98]">
                <Plus className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Add</span>
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
                      aria-label={`Edit ${member.name}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => openDeleteConfirmDialog('member', member.id, member.name)}
                      aria-label={`Delete ${member.name}`}
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
              <BalancesList balances={balances} />
              <TransactionList />
            </>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              Add some expenses to see the balances
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Member Dialog */}
      <Dialog open={editMemberDialogOpen} onOpenChange={setEditMemberDialogOpen}>
        <DialogContent className="bento-tile !p-6">
          <DialogHeader>
            <DialogTitle>Edit member</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Member name"
              value={editedMemberName}
              onChange={(e) => setEditedMemberName(e.target.value)}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMemberDialogOpen(false)}>Cancel</Button>
            <Button className="app-button-primary" onClick={handleEditMember}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirmDialogOpen} onOpenChange={setDeleteConfirmDialogOpen}>
        <DialogContent className="bento-tile !p-6">
          <DialogHeader>
            <DialogTitle>Confirm delete</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-foreground">
              Are you sure you want to delete this {deleteItemType}?
              <br />
              <span className="font-medium">{deleteItemName}</span>
            </p>
            {deleteItemType === 'member' && (
              <p className="text-sm text-muted-foreground mt-2">
                Note: You cannot delete members that are part of expenses.
              </p>
            )}
            {deleteItemType === 'group' && (
              <p className="text-sm text-muted-foreground mt-2">
                This removes the group, expenses, and payments from this device. Copies on other devices stay unchanged until you explicitly sync the deletion.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDeleteConfirm()}>
              {deleteItemType === 'group' ? 'Remove group' : 'Delete'}
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
    </Layout>
  );
};

export default GroupDetail;
