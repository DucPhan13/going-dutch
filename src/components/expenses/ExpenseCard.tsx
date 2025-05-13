import React from 'react';
import { Expense, Member } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2 } from 'lucide-react';

interface ExpenseCardProps {
  expense: Expense;
  members: Member[];
  onEdit: () => void;
  onDelete: () => void;
}

const ExpenseCard: React.FC<ExpenseCardProps> = ({ expense, members, onEdit, onDelete }) => {
  const getMemberName = (id: string) => {
    return members.find(member => member.id === id)?.name || 'Unknown';
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium">{expense.description}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Paid by: {getMemberName(expense.paidBy)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Participants: {expense.participants.map(id => getMemberName(id)).join(', ')}
            </p>
            {/* {expense.date && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Date: {new Date(expense.date).toLocaleDateString('vi-VN')}
              </p>
            )} */}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-red-500 hover:text-red-700 hover:bg-red-100"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-lg font-semibold mt-2">
          {expense.amount.toLocaleString('vi-VN')} đ
        </p>
      </CardContent>
    </Card>
  );
};

export default ExpenseCard;