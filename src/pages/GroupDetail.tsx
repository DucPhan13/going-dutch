
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
import { Plus } from 'lucide-react';

const GroupDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { groups, selectGroup, currentGroup, addMember, calculateBalances } = useGroupContext();
  const [newMemberName, setNewMemberName] = useState('');
  const [activeTab, setActiveTab] = useState('expenses');
  
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
          <p className="text-gray-500 mb-6">The group you're looking for doesn't exist.</p>
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
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Expense
                </Button>
              )}
            </div>
            
            {currentGroup.members.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500 mb-4">Add members to start tracking expenses</p>
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
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500 mb-4">No expenses yet</p>
                <Button 
                  onClick={() => navigate(`/group/${currentGroup.id}/add-expense`)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add First Expense
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="members">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Members</h2>
            </div>
            
            <Card className="mb-6">
              <CardContent className="p-4">
                <form onSubmit={handleAddMember} className="flex space-x-2">
                  <Input
                    placeholder="Enter member name"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    Add
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            {currentGroup.members.length > 0 ? (
              <div className="space-y-3">
                {currentGroup.members.map((member) => (
                  <Card key={member.id} className="bg-white">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{member.name}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                No members yet
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="balances">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Balances</h2>
            </div>
            
            {currentGroup.expenses.length > 0 ? (
              <BalancesList balances={balances} />
            ) : (
              <div className="text-center py-6 text-gray-500">
                Add some expenses to see the balances
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default GroupDetail;
