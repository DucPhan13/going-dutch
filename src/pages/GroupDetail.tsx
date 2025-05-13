import React, { useState, useEffect } from 'react';
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
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

const GroupDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    groups, 
    selectGroup, 
    currentGroup, 
    addMember, 
    editMember,
    removeMember,
    removeExpense,
    calculateBalances
  } = useGroupContext();
  const { toast } = useToast();
  
  const [newMemberName, setNewMemberName] = useState('');
  const [activeTab, setActiveTab] = useState('expenses');
  
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<{ id: string, name: string } | null>(null);
  const [editedMemberName, setEditedMemberName] = useState('');
  
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [deleteItemType, setDeleteItemType] = useState<'member' | 'expense' | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deleteItemName, setDeleteItemName] = useState('');
  
  useEffect(() => {
    if (id) {
      selectGroup(id);
    }
  }, [id, selectGroup]);
  
  if (!currentGroup) {
    return (
      <Layout title="Group Not Found" showBack>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Group not found</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">The group you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/')} variant="outline">
            Go to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }
  
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMemberName.trim()) {
      addMember(newMemberName.trim());
      setNewMemberName('');
    }
  };
  
  const openEditMemberDialog = (member: { id: string, name: string }) => {
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
  
  const openDeleteConfirmDialog = (type: 'member' | 'expense', id: string, name: string) => {
    setDeleteItemType(type);
    setDeleteItemId(id);
    setDeleteItemName(name);
    setDeleteConfirmDialogOpen(true);
  };
  
  const handleDeleteConfirm = () => {
    if (!deleteItemId || !deleteItemType) return;
    
    if (deleteItemType === 'member') {
      removeMember(deleteItemId);
    } else if (deleteItemType === 'expense') {
      removeExpense(deleteItemId);
    }
    
    setDeleteConfirmDialogOpen(false);
    setDeleteItemId(null);
    setDeleteItemType(null);
  };
  
  const balances = calculateBalances();
  
  return (
    <Layout title={currentGroup.name} showBack>
      <div className="mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="balances">Balances</TabsTrigger>
          </TabsList>
          
          <TabsContent value="expenses">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Expenses</h2>
              {currentGroup.members.length > 0 && (
                <Button 
                  onClick={() => navigate(`/group/${currentGroup.id}/add-expense`)}
                  className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Expense
                </Button>
              )}
            </div>
            
            {currentGroup.members.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500 dark:text-gray-400 mb-4">Add members to start tracking expenses</p>
                <Button onClick={() => setActiveTab('members')} variant="outline">
                  Add Members
                </Button>
              </div>
            ) : currentGroup.expenses.length > 0 ? (
              <div className="space-y-3">
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
              <div className="text-center py-6">
                <p className="text-gray-500 dark:text-gray-400 mb-4">No expenses yet</p>
                <Button 
                  onClick={() => navigate(`/group/${currentGroup.id}/add-expense`)}
                  className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add First Expense
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="members">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Members</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">You can add multiple members at once by separating names with commas</p>
            </div>
            
            <Card className="mb-6">
              <CardContent className="p-4">
                <form onSubmit={handleAddMember} className="flex space-x-2">
                  <Input
                    placeholder="Enter member name(s), e.g. John, Jane, Bob"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800">
                    Add
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            {currentGroup.members.length > 0 ? (
              <div className="space-y-3">
                {currentGroup.members.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{member.name}</span>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openEditMemberDialog(member)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-red-500 hover:text-red-700 hover:bg-red-100"
                            onClick={() => openDeleteConfirmDialog('member', member.id, member.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                No members yet
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="balances">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Balances</h2>
            </div>
            
            {currentGroup.expenses.length > 0 ? (
              <>
                <BalancesList balances={balances} />
                <TransactionList />
              </>
            ) : (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                Add some expenses to see the balances
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={editMemberDialogOpen} onOpenChange={setEditMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
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
            <Button onClick={handleEditMember}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmDialogOpen} onOpenChange={setDeleteConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>
              Are you sure you want to delete this {deleteItemType}?
              <br />
              <span className="font-medium">{deleteItemName}</span>
            </p>
            {deleteItemType === 'member' && (
              <p className="text-sm text-gray-500 mt-2">
                Note: You cannot delete members that are part of expenses.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default GroupDetail;