import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Landmark, WalletCards } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { useGroupContext } from '@/contexts/GroupContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Avatar from '@/components/ui/avatar';
import { Balance } from '@/types';
import { usePreferences } from '@/contexts/PreferencesContext';

export default function SettleUp() {
  const { id } = useParams<{id:string}>(); const navigate = useNavigate(); const { selectGroup, currentGroup, calculateBalances, markBalanceAsPaid } = useGroupContext(); const [method, setMethod] = useState('bankTransfer'); const [pendingPayment, setPendingPayment] = useState<Balance | null>(null); const { t, formatVnd } = usePreferences();
  useEffect(() => { if (id) selectGroup(id); }, [id, selectGroup]);
  if (!currentGroup) return <Layout title={t('settleUp')} showBack><div className="app-surface p-8 text-center text-muted-foreground">{t('paymentUnavailable')}</div></Layout>;
  const balances = calculateBalances(); const member = (memberId: string) => currentGroup.members.find(item => item.id === memberId)?.name || t('unknown');
  const methodLabel = method === 'cash' ? t('cash') : method === 'eWallet' ? t('eWallet') : t('bankTransfer');
  const confirmPayment = () => { if (!pendingPayment) return; markBalanceAsPaid(pendingPayment, method); setPendingPayment(null); };
  return <Layout title={t('settleUp')} showBack backTo={`/group/${currentGroup.id}`}><div className="mx-auto max-w-2xl"><section className="app-surface-strong p-6"><div className="flex items-start gap-3"><div className="icon-tile grid h-11 w-11 place-items-center"><WalletCards className="h-5 w-5 balance-positive" /></div><div><p className="section-label">{currentGroup.name}</p><h1 className="mt-1 text-2xl font-semibold">{t('settleUp')}</h1><p className="mt-1 text-sm text-muted-foreground">{t('recordPayment')}</p></div></div><div className="mt-6 max-w-xs"><p className="mb-2 text-sm font-medium">{t('paymentMethod')}</p><Select value={method} onValueChange={setMethod}><SelectTrigger className="app-input h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bankTransfer">{t('bankTransfer')}</SelectItem><SelectItem value="cash">{t('cash')}</SelectItem><SelectItem value="eWallet">{t('eWallet')}</SelectItem></SelectContent></Select></div></section>
    <section className="mt-6"><div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-lg font-semibold">{t('suggestedPayments')}</h2><span className="text-sm text-muted-foreground sm:text-right">{t('simplifiedDebts')}</span></div>{balances.length ? <div className="space-y-3">{balances.map(balance => <div key={balance.id} className="app-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><Avatar name={member(balance.from)} className="h-10 w-10" /><div className="min-w-0"><p className="truncate text-sm text-muted-foreground">{t('pays', { from: member(balance.from), to: member(balance.to) })}</p><p className="amount mt-1 text-xl font-semibold balance-negative">{formatVnd(balance.amount)}</p></div></div><Button onClick={() => setPendingPayment(balance)} className="app-button-primary shrink-0 gap-2"><Landmark className="h-4 w-4" />{t('recordPaymentAction')}</Button></div>)}</div> : <div className="app-surface flex flex-col items-center py-14 text-center"><CheckCircle2 className="h-9 w-9 balance-positive" /><h2 className="mt-4 text-xl font-semibold">{t('everyoneSettled')}</h2><p className="mt-2 text-muted-foreground">{t('everyoneSettledBody')}</p></div>}</section></div>
    <Dialog open={Boolean(pendingPayment)} onOpenChange={open => !open && setPendingPayment(null)}><DialogContent className="app-surface !p-6"><DialogHeader><DialogTitle>{t('reviewPayment')}</DialogTitle><DialogDescription>{pendingPayment && t('reviewPaymentBody', { from: member(pendingPayment.from), to: member(pendingPayment.to), amount: formatVnd(pendingPayment.amount), method: methodLabel })}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setPendingPayment(null)}>{t('cancel')}</Button><Button onClick={confirmPayment} className="app-button-primary gap-2"><Landmark className="h-4 w-4" />{t('recordPaymentAction')}</Button></DialogFooter></DialogContent></Dialog>
  </Layout>;
}
