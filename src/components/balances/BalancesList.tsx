
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Balance } from '@/types';
import { useGroupContext } from '@/contexts/GroupContext';

interface BalancesListProps {
  balances: Balance[];
}

export default function BalancesList({ balances }: BalancesListProps) {
  const { currentGroup } = useGroupContext();

  if (!currentGroup) return null;
  
  const getMemberName = (id: string) => {
    return currentGroup.members.find(m => m.id === id)?.name || 'Unknown';
  };
  
  if (balances.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        Everyone is settled up! No payments needed.
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {balances.map((balance, index) => (
        <Card key={index} className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-medium">{getMemberName(balance.from)}</span>
                <span className="text-gray-500 mx-2">pays</span>
                <span className="font-medium">{getMemberName(balance.to)}</span>
              </div>
              <div className="font-bold text-blue-600">${balance.amount.toFixed(2)}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
