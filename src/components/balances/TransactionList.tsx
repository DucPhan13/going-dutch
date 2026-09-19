import { useGroupContext } from '@/contexts/GroupContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ArrowDownUp } from 'lucide-react';
import Avatar from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useEffect, useState } from 'react';
import { usePreferences } from '@/contexts/PreferencesContext';

const TransactionList = () => {
  const { currentGroup, clearTransactions, undoClearTransactions } = useGroupContext();
  const { t, formatVnd, language } = usePreferences();
  const [clearPending, setClearPending] = useState(false);
  const [undoAvailable, setUndoAvailable] = useState(false);

  useEffect(() => {
    if (!undoAvailable) return;
    const timer = window.setTimeout(() => setUndoAvailable(false), 10_000);
    return () => window.clearTimeout(timer);
  }, [undoAvailable]);

  if (!currentGroup) return null;

  const getMemberName = (id: string) => {
    return currentGroup.members.find((member) => member.id === id)?.name || t('unknown');
  };

  return (
    <Card className="mt-6 glass-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowDownUp className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">{t('transactionHistory')}</h3>
          </div>
          {currentGroup.transactions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearPending(true)}
              className="h-9 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('clear')}
            </Button>
          )}
        </div>

        {clearPending && (
          <Alert className="mb-4 border-destructive/40">
            <AlertTitle>{t('clearRecordedPayments')}</AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <p>{t('clearPaymentsBody', { count: currentGroup.transactions.length })}</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setClearPending(false)}>{t('cancel')}</Button>
                <Button type="button" variant="destructive" size="sm" onClick={() => { void clearTransactions().then(cleared => { if (!cleared) return; setClearPending(false); setUndoAvailable(true); }); }}>{t('clearPayments')}</Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {undoAvailable && (
          <Alert className="mb-4 border-amber-500/40">
            <AlertTitle>{t('paymentHistoryCleared')}</AlertTitle>
            <AlertDescription className="mt-2 flex items-center justify-between gap-3">
              <span>{t('undoAvailable')}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => { undoClearTransactions(); setUndoAvailable(false); }}>{t('undo')}</Button>
            </AlertDescription>
          </Alert>
        )}

        {currentGroup.transactions.length > 0 ? (
          <div className="space-y-0">
            {currentGroup.transactions
              .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
              .map((transaction, i) => (
                <div
                  key={transaction.id}
                  className={`flex items-center justify-between py-3 ${
                    i !== currentGroup.transactions.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Avatar name={getMemberName(transaction.from)} className="w-7 h-7 text-[10px]" />
                      <ArrowDownUp className="w-3 h-3 text-muted-foreground/50" />
                      <Avatar name={getMemberName(transaction.to)} className="w-7 h-7 text-[10px]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-muted-foreground">
                        <span className="text-foreground">{getMemberName(transaction.from)}</span>
                        {' → '}
                        <span className="text-foreground">{getMemberName(transaction.to)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="amount text-sm font-semibold text-foreground">
                      {formatVnd(transaction.amount)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(transaction.paidAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
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
            {t('noTransactions')}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionList;
