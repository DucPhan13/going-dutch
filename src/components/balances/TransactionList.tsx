import React from 'react';
import { Transaction, Member } from '@/types';
import { useGroupContext } from '@/contexts/GroupContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

const TransactionList: React.FC = () => {
  const { currentGroup, clearTransactions } = useGroupContext();

  if (!currentGroup) return null;

  const getMemberName = (id: string) => {
    return currentGroup.members.find((member) => member.id === id)?.name || 'Unknown';
  };

  return (
    <Card className="mt-6">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold">Transaction History</h3>
          {currentGroup.transactions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearTransactions}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Clear History
            </Button>
          )}
        </div>
        {currentGroup.transactions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Paid On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentGroup.transactions
                .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
                .map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{getMemberName(transaction.from)}</TableCell>
                    <TableCell>{getMemberName(transaction.to)}</TableCell>
                    <TableCell>{transaction.amount.toLocaleString('vi-VN')} đ</TableCell>
                    <TableCell>
                      {new Date(transaction.paidAt).toLocaleDateString('vi-VN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400">
            No transactions recorded yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionList;