
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Balance } from '@/types';
import { useGroupContext } from '@/contexts/GroupContext';
import BalanceActions from './BalanceActions';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface BalancesListProps {
  balances: Balance[];
}

export default function BalancesList({ balances }: BalancesListProps) {
  const { currentGroup, clearPaidBalances, paidBalances } = useGroupContext();

  if (!currentGroup) return null;
  
  const getMemberName = (id: string) => {
    return currentGroup.members.find(m => m.id === id)?.name || 'Unknown';
  };
  
  // Format number with VND
  const formatVND = (amount: number) => {
    return amount.toLocaleString('vi-VN');
  };
  
  if (balances.length === 0 && paidBalances.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        Everyone is settled up! No payments needed.
      </div>
    );
  }
  
  return (
    <div>
      {paidBalances.length > 0 && (
        <div className="mb-6 flex justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearPaidBalances}
            className="text-red-500 border-red-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Clear Paid Transactions ({paidBalances.length})
          </Button>
        </div>
      )}
      
      {balances.length === 0 && paidBalances.length > 0 ? (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          All current transactions are paid!
        </div>
      ) : (
        <div className="space-y-3">
          {balances.map((balance, index) => (
            <Card key={index} className="border-gray-200 dark:border-gray-800">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{getMemberName(balance.from)}</span>
                    <span className="text-gray-500 dark:text-gray-400 mx-2">pays</span>
                    <span className="font-medium">{getMemberName(balance.to)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-blue-600 dark:text-blue-400">{formatVND(balance.amount)} ₫</div>
                    <BalanceActions balance={balance} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {paidBalances.length > 0 && (
        <div className="mt-8">
          <h3 className="text-md font-semibold mb-3">Paid Transactions</h3>
          <div className="space-y-3">
            {paidBalances.map((balance, index) => (
              <Card key={index} className="border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 opacity-60">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{getMemberName(balance.from)}</span>
                      <span className="text-gray-500 dark:text-gray-400 mx-2">paid</span>
                      <span className="font-medium">{getMemberName(balance.to)}</span>
                    </div>
                    <div className="font-bold text-green-600 dark:text-green-400">{formatVND(balance.amount)} ₫</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
