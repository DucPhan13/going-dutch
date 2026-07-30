import { Balance } from '@/types';
import { useGroupContext } from '@/contexts/GroupContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight } from 'lucide-react';
import Avatar from '@/components/ui/avatar';

interface BalancesListProps {
  balances: Balance[];
}

const BalancesList = ({ balances }: BalancesListProps) => {
  const { currentGroup, markBalanceAsPaid } = useGroupContext();

  if (!currentGroup) return null;

  const getMemberName = (id: string) => {
    return currentGroup.members.find((member) => member.id === id)?.name || 'Unknown';
  };

  return (
    <div className="space-y-3">
      {balances.length > 0 ? (
        balances.map((balance) => (
          <Card key={balance.id} className="glass-card">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Avatar name={getMemberName(balance.from)} className="w-9 h-9" />
                  <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <Avatar name={getMemberName(balance.to)} className="w-9 h-9" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground truncate">
                    <span className="font-medium text-foreground">{getMemberName(balance.from)}</span>
                    {' '} owes{' '}
                    <span className="font-medium text-foreground">{getMemberName(balance.to)}</span>
                  </p>
                  <p className="amount text-lg font-semibold balance-negative">
                    {balance.amount.toLocaleString('vi-VN')} đ
                  </p>
                </div>
              </div>
              <Button
                onClick={() => markBalanceAsPaid(balance)}
                className="app-button-primary flex-shrink-0 gap-2"
                size="sm"
              >
                <Check className="w-4 h-4" />
                <span className="hidden sm:inline">Mark paid</span>
              </Button>
            </CardContent>
          </Card>
        ))
      ) : (
        <div className="text-center py-10">
          <Check className="w-10 h-10 mx-auto mb-3 balance-positive" />
          <p className="text-foreground font-medium">All settled up</p>
          <p className="text-sm text-muted-foreground mt-1">No outstanding balances.</p>
        </div>
      )}
    </div>
  );
};

export default BalancesList;
