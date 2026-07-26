import { Expense, Member } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, User, Utensils, Home, Car, Plane, Ticket } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';

interface ExpenseCardProps {
  expense: Expense;
  members: Member[];
  onEdit: () => void;
  onDelete: () => void;
}

const ExpenseCard = ({ expense, members, onEdit, onDelete }: ExpenseCardProps) => {
  const getMemberName = (id: string) => {
    return members.find(member => member.id === id)?.name || 'Unknown';
  };

  const Icon = expense.category === 'Food & drinks' ? Utensils : expense.category === 'Home' ? Home : expense.category === 'Transport' ? Car : expense.category === 'Travel' ? Plane : expense.category === 'Entertainment' ? Ticket : User;

  return (
    <Card className="glass-card-hover cursor-default">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-foreground truncate">{expense.description}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                by <span className="text-foreground font-medium">{getMemberName(expense.paidBy)}</span>
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="flex -space-x-1.5">
                  {expense.participants.slice(0, 3).map((id) => (
                    <Avatar key={id} name={getMemberName(id)} className="w-5 h-5 border border-background text-[9px]" />
                  ))}
                </div>
                {expense.participants.length > 3 && (
                  <span className="text-[10px] text-muted-foreground ml-0.5">+{expense.participants.length - 3}</span>
                )}
                <span className="text-[10px] text-muted-foreground ml-1">
                  {expense.participants.length} split
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="flex gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                className="h-8 w-8 hover:bg-white/5 text-muted-foreground hover:text-foreground"
                aria-label="Edit expense"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-950/50"
                onClick={onDelete}
                aria-label="Delete expense"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="amount text-lg font-semibold text-foreground">
              {expense.amount.toLocaleString('vi-VN')} đ
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExpenseCard;
