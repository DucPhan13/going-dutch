import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useGroupContext } from '@/contexts/GroupContext';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Expense } from '@/types';

const AddExpense = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectGroup, currentGroup, addExpense, editExpense } = useGroupContext();
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [participants, setParticipants] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Check if editing via query parameter
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const editId = query.get('edit');
    if (editId && currentGroup) {
      const expense = currentGroup.expenses.find(e => e.id === editId);
      if (expense) {
        setIsEditing(true);
        setEditingExpenseId(editId);
        setDescription(expense.description);
        setAmount(expense.amount.toString());
        setPaidBy(expense.paidBy);
        const participantState: Record<string, boolean> = {};
        currentGroup.members.forEach(member => {
          participantState[member.id] = expense.participants.includes(member.id);
        });
        setParticipants(participantState);
      }
    }
  }, [location.search, currentGroup]);

  // Select group
  useEffect(() => {
    if (id) {
      selectGroup(id);
    }
  }, [id, selectGroup]);

  // Initialize form for new expense
  useEffect(() => {
    if (currentGroup && currentGroup.members.length > 0 && !isEditing) {
      if (!paidBy) {
        setPaidBy(currentGroup.members[0].id);
      }
      const initialParticipants: Record<string, boolean> = {};
      currentGroup.members.forEach(member => {
        initialParticipants[member.id] = true;
      });
      setParticipants(initialParticipants);
    }
  }, [currentGroup, paidBy, isEditing]);

  if (!currentGroup) {
    return (
      <Layout title="Group Not Found" showBack>
        <div className="text-center py-12">
          <p className="text-gray-500">The group you're looking for doesn't exist.</p>
        </div>
      </Layout>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    let parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    } else if (parsedAmount < 1000) {
      parsedAmount = parsedAmount * 1000;
    }

    if (!paidBy) {
      newErrors.paidBy = 'Please select who paid';
    }

    const selectedParticipants = Object.entries(participants)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => id);

    if (selectedParticipants.length === 0) {
      newErrors.participants = 'Select at least one participant';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      const expenseData: Omit<Expense, "id"> = {
        description: description.trim(),
        amount: parsedAmount,
        paidBy,
        date: new Date().toISOString(),
        participants: selectedParticipants
      };

      if (isEditing && editingExpenseId) {
        editExpense(editingExpenseId, expenseData);
      } else {
        addExpense(expenseData);
      }
      navigate(`/group/${currentGroup.id}`);
    }
  };

  const toggleParticipant = (memberId: string) => {
    setParticipants(prev => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
    if (errors.participants) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.participants;
        return newErrors;
      });
    }
  };

  const handleSelectAllParticipants = () => {
    const newParticipants: Record<string, boolean> = {};
    currentGroup.members.forEach(member => {
      newParticipants[member.id] = true;
    });
    setParticipants(newParticipants);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
    if (errors.amount) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.amount;
        return newErrors;
      });
    }
  };

  return (
    <Layout 
      title={isEditing ? "Edit Expense" : "Add Expense"} 
      showBack={true} 
      backTo={`/group/${currentGroup.id}`}
    >
      <div className="max-w-md mx-auto">
        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>{isEditing ? "Edit Expense" : "Add a new expense"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Dinner, Groceries, etc."
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      if (errors.description) {
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.description;
                          return newErrors;
                        });
                      }
                    }}
                    className={errors.description ? "border-red-500" : ""}
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-500">{errors.description}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={handleAmountChange}
                    className={errors.amount ? "border-red-500" : ""}
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    *Numbers less than 1000 will be converted to thousands (e.g., 100 → 100,000đ)
                  </p>
                  {errors.amount && (
                    <p className="mt-1 text-sm text-red-500">{errors.amount}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="paidBy">Paid by</Label>
                  <Select 
                    value={paidBy} 
                    onValueChange={(value) => {
                      setPaidBy(value);
                      if (errors.paidBy) {
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.paidBy;
                          return newErrors;
                        });
                      }
                    }}
                  >
                    <SelectTrigger className={errors.paidBy ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select who paid" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentGroup.members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.paidBy && (
                    <p className="mt-1 text-sm text-red-500">{errors.paidBy}</p>
                  )}
                </div>

                <div>
                  <Label className="mb-2 block">Split with</Label>
                  <div className="mb-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={handleSelectAllParticipants}
                    >
                      Select All
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {currentGroup.members.map((member) => (
                      <div key={member.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`participant-${member.id}`} 
                          checked={!!participants[member.id]}
                          onCheckedChange={() => toggleParticipant(member.id)}
                        />
                        <Label htmlFor={`participant-${member.id}`} className="cursor-pointer">
                          {member.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {errors.participants && (
                    <p className="mt-1 text-sm text-red-500">{errors.participants}</p>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {isEditing ? "Update Expense" : "Add Expense"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </Layout>
  );
};

export default AddExpense;