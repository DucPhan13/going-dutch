import { Card, CardContent } from '@/components/ui/card';
import { Group } from '@/types';
import { useNavigate } from 'react-router-dom';
import Avatar from '@/components/ui/avatar';
import { ArrowUpRight, ReceiptText, Users } from 'lucide-react';

interface GroupCardProps {
  group: Group;
}

export default function GroupCard({ group }: GroupCardProps) {
  const navigate = useNavigate();

  const totalExpenses = group.expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const formatVND = (amount: number) => {
    return amount.toLocaleString('vi-VN');
  };

  return (
    <Card
      className="glass-card-hover group border-border bg-card"
      onClick={() => navigate(`/group/${group.id}`)}
      tabIndex={0}
      onKeyDown={(event) => event.key === 'Enter' && navigate(`/group/${group.id}`)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="section-label mb-1">Shared group</p>
            <h3 className="text-lg font-semibold text-foreground truncate">
              {group.name}
            </h3>
          </div>
          <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
        <div className="mt-5 flex items-center gap-2">
          <div className="flex -space-x-2 overflow-hidden">
            {group.members.slice(0, 4).map((member) => (
              <Avatar key={member.id} name={member.name} className="w-7 h-7 border-2 border-background text-[10px]" />
            ))}
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />{group.members.length} people</span>
        </div>
        <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ReceiptText className="w-3.5 h-3.5" />
            {group.expenses.length} expense{group.expenses.length !== 1 ? 's' : ''}
          </span>
          <span className="amount text-base font-semibold balance-positive">
            {formatVND(totalExpenses)} đ
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
