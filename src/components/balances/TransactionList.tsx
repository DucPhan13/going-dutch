import { useGroupContext } from '@/contexts/GroupContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ArrowDownUp } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';

const TransactionList = () => {
  const { currentGroup, clearTransactions } = useGroupContext();

  if (!currentGroup) return null;

  const getMemberName = (id: string) => {
    return currentGroup.members.find((member) => member.id === id)?.name || 'Unknown';
  };

  return (
    <Card className="mt-6 glass-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowDownUp className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Transaction history</h3>
          </div>
          {currentGroup.transactions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearTransactions}
              className="text-red-400 hover:text-red-300 hover:bg-red-950/30 border-white/10 gap-1.5 h-8"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </Button>
          )}
        </div>

        {currentGroup.transactions.length > 0 ? (
          <div className="space-y-0">
            {currentGroup.transactions
              .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
              .map((transaction, i) => (
                <div
                  key={transaction.id}
                  className={`flex items-center justify-between py-3 ${
                    i !== currentGroup.transactions.length - 1 ? 'border-b border-white/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Avatar name={getMemberName(transaction.from)} className="w-7 h-7 text-[10px]" />
                      <ArrowDownUp className="w-3 h-3 text-muted-foreground/50" />
                      <Avatar name={getMemberName(transaction.to)} className="w-7 h-7 text-[10px]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">
                        <span className="text-foreground">{getMemberName(transaction.from)}</span>
                        {' → '}
                        <span className="text-foreground">{getMemberName(transaction.to)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-semibold text-emerald-400 font-mono tabular-nums">
                      {transaction.amount.toLocaleString('vi-VN')} đ
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(transaction.paidAt).toLocaleDateString('vi-VN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">
            No transactions recorded yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionList;
