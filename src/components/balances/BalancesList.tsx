import React from 'react';
import { Balance, Member } from '@/types';
import { useGroupContext } from '@/contexts/GroupContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface BalancesListProps {
  balances: Balance[];
}

const BalancesList: React.FC<BalancesListProps> = ({ balances }) => {
  const { currentGroup, markBalanceAsPaid } = useGroupContext();

  if (!currentGroup) return null;

  const getMemberName = (id: string) => {
    return currentGroup.members.find((member) => member.id === id)?.name || 'Unknown';
  };

  return (
    <div className="space-y-3">
      {balances.length > 0 ? (
        balances.map((balance) => (
          <Card key={balance.id}>
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">
                  {getMemberName(balance.from)} owes {getMemberName(balance.to)}
                </p>
                <p className="text-lg font-semibold">
                  {balance.amount.toLocaleString('vi-VN')} đ
                </p>
              </div>
              <Button
                onClick={() => markBalanceAsPaid(balance)}
                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
              >
                <Check className="mr-2 h-4 w-4" /> Mark Paid
              </Button>
            </CardContent>
          </Card>
        ))
      ) : (
        <p className="text-center text-gray-500 dark:text-gray-400">
          No outstanding balances.
        </p>
      )}
    </div>
  );
};

export default BalancesList;