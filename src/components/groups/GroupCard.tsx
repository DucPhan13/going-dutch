
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Group } from '@/types';
import { useNavigate } from 'react-router-dom';

interface GroupCardProps {
  group: Group;
}

export default function GroupCard({ group }: GroupCardProps) {
  const navigate = useNavigate();
  
  const totalExpenses = group.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  // Format number with VND
  const formatVND = (amount: number) => {
    return amount.toLocaleString('vi-VN');
  };
  
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => navigate(`/group/${group.id}`)}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{group.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500 dark:text-gray-400">Members:</span>
          <span className="font-medium">{group.members.length}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500 dark:text-gray-400">Expenses:</span>
          <span className="font-medium">{group.expenses.length}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Total:</span>
          <span className="font-medium">{formatVND(totalExpenses)} ₫</span>
        </div>
      </CardContent>
    </Card>
  );
}
