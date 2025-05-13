
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Expense, Member } from '@/types';

interface ExpenseCardProps {
  expense: Expense;
  members: Member[];
}

export default function ExpenseCard({ expense, members }: ExpenseCardProps) {
  const paidByMember = members.find(member => member.id === expense.paidBy);
  const participantNames = members
    .filter(member => expense.participants.includes(member.id))
    .map(member => member.name)
    .join(', ');
  
  const formattedDate = new Date(expense.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h3 className="font-medium">{expense.description}</h3>
            <p className="text-sm text-gray-500">
              Paid by {paidByMember?.name || 'Unknown'}
            </p>
            <p className="text-xs text-gray-400">
              Split with: {participantNames}
            </p>
          </div>
          <div className="text-right">
            <div className="font-semibold">${expense.amount.toFixed(2)}</div>
            <div className="text-xs text-gray-400">{formattedDate}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
