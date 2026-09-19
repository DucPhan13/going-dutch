import { Expense, Member } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, User, Utensils, Home, Car, Plane, Ticket } from 'lucide-react';
import Avatar from '@/components/ui/avatar';
import { usePreferences } from '@/contexts/PreferencesContext';

interface ExpenseCardProps {
  expense: Expense;
  members: Member[];
  onEdit: () => void;
  onDelete: () => void;
}

const ExpenseCard = ({ expense, members, onEdit, onDelete }: ExpenseCardProps) => {
  const { t, formatVnd } = usePreferences();
  const getMemberName = (id: string) => {
    return members.find(member => member.id === id)?.name || t('unknown');
  };

  const Icon = expense.category === 'Food & drinks' ? Utensils : expense.category === 'Home' ? Home : expense.category === 'Transport' ? Car : expense.category === 'Travel' ? Plane : expense.category === 'Entertainment' ? Ticket : User;

  return (
    <Card className="glass-card-hover cursor-default">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="icon-tile flex h-10 w-10 shrink-0 items-center justify-center mt-0.5">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-foreground truncate">{expense.description}</h3>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {t('paidByPerson', { name: getMemberName(expense.paidBy) })}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="flex -space-x-1.5">
                  {expense.participants.slice(0, 3).map((id) => (
                    <Avatar key={id} name={getMemberName(id)} className="w-5 h-5 border border-background text-xs" />
                  ))}
                </div>
                {expense.participants.length > 3 && (
                  <span className="ml-0.5 text-xs text-muted-foreground">+{expense.participants.length - 3}</span>
                )}
                <span className="ml-1 text-xs text-muted-foreground">{t('people', { count: expense.participants.length })}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="flex gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                className="h-10 w-10 hover:bg-accent text-muted-foreground hover:text-foreground"
                aria-label={t('editExpenseLabel')}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
                aria-label={t('deleteExpenseLabel')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="amount text-lg font-semibold text-foreground">
              {formatVnd(expense.amount)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExpenseCard;
