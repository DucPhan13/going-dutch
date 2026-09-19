import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownUp, ReceiptText } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { useGroupContext } from '@/contexts/GroupContext';
import { usePreferences } from '@/contexts/PreferencesContext';

export default function Activity() {
  const navigate = useNavigate(); const { groups } = useGroupContext();
  const { t, formatVnd, language } = usePreferences();
  const entries = useMemo(() => groups.flatMap(group => [
    ...group.expenses.map(item => ({ id: item.id, at: item.date || '', kind: 'expense' as const, group, item })),
    ...group.transactions.map(item => ({ id: item.id, at: item.paidAt, kind: 'payment' as const, group, item })),
  ]).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), [groups]);
  const name = (group: typeof groups[number], memberId: string) => group.members.find(member => member.id === memberId)?.name || t('unknown');
  return <Layout title={t('appName')}><div className="collection-page"><section className="collection-page-header"><div className="min-w-0"><h1 className="page-title">{t('activity')}</h1><p className="page-description mt-3 text-muted-foreground">{t('activityDescription')}</p></div></section>
    {entries.length ? <div className="app-surface divide-y divide-border px-4 sm:px-5">{entries.map(entry => <button key={`${entry.kind}-${entry.id}`} className="flex w-full items-center gap-3 py-4 text-left" onClick={() => navigate(`/group/${entry.group.id}`)}><div className="icon-tile grid h-10 w-10 shrink-0 place-items-center">{entry.kind === 'expense' ? <ReceiptText className="h-4 w-4 text-muted-foreground" /> : <ArrowDownUp className="h-4 w-4 balance-positive" />}</div><div className="min-w-0 flex-1"><p className="truncate font-medium">{entry.kind === 'expense' ? entry.item.description : t('paidPerson', { from: name(entry.group, entry.item.from), to: name(entry.group, entry.item.to) })}</p><p className="mt-0.5 truncate text-sm text-muted-foreground">{entry.group.name} · {new Date(entry.at).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { day: 'numeric', month: 'short' })}</p></div><p className={`amount shrink-0 font-medium ${entry.kind === 'expense' ? '' : 'balance-positive'}`}>{formatVnd(entry.item.amount)}</p></button>)}</div> : <div className="app-surface px-6 py-16 text-center"><ReceiptText className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-4 text-xl font-semibold">{t('activityEmptyTitle')}</h2><p className="mt-2 text-muted-foreground">{t('activityEmptyBody')}</p></div>}
  </div></Layout>;
}
