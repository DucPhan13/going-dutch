import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupContext } from '@/contexts/GroupContext';
import Layout from '@/components/layout/Layout';
import GroupCard from '@/components/groups/GroupCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, CircleDollarSign, Plus, ShieldCheck, Wifi } from 'lucide-react';
import { usePreferences } from '@/contexts/PreferencesContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { beginNearbyJoin, groups } = useGroupContext();
  const { t, formatVnd } = usePreferences();
  const [joinOpen, setJoinOpen] = useState(false);
  const [nearbyCode, setNearbyCode] = useState('');
  const nearbyCodeInputs = useRef<Array<HTMLInputElement | null>>([]);

  const setNearbyDigits = (startIndex: number, value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6 - startIndex);
    if (!digits) return;
    setNearbyCode(current => {
      const next = current.padEnd(6, ' ').split('');
      digits.split('').forEach((digit, offset) => { next[startIndex + offset] = digit; });
      return next.join('').trimEnd();
    });
    nearbyCodeInputs.current[Math.min(startIndex + digits.length, 5)]?.focus();
  };

  const clearNearbyDigit = (index: number) => setNearbyCode(current => {
    const next = current.padEnd(6, ' ').split('');
    next[index] = ' ';
    return next.join('').trimEnd();
  });

  const recent = groups.flatMap(group => group.expenses.map(expense => ({ ...expense, groupName: group.name, groupId: group.id }))).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).slice(0, 4);

  return (
    <Layout
      title={t('appName')}
      headerActions={
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setJoinOpen(true)} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label={t('joinSync')}><Wifi className="h-4 w-4" /></Button>
        </div>
      }
    >
      <section className="collection-page-header">
        <div className="min-w-0">
          <h1 className="page-title">{t('yourGroups')}</h1>
          <p className="page-description mt-3 text-muted-foreground">{t('localFirstSplitTool')}</p>
        </div>
        <Button onClick={() => navigate('/create-group')} className="app-button-primary h-11 shrink-0 gap-2">
          <Plus className="h-4 w-4" />{t('newGroup')}
        </Button>
      </section>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="max-w-[calc(100vw_-_2rem)] sm:max-w-md">
          <div className="flex items-start gap-3 pr-8">
            <div className="icon-tile grid h-11 w-11 shrink-0 place-items-center">
              <Wifi className="h-5 w-5 text-muted-foreground" />
            </div>
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle>{t('joinNearbySync')}</DialogTitle>
              <DialogDescription>{t('nearbyCodeHelp')}</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={event => { event.preventDefault(); if (/^\d{6}$/.test(nearbyCode)) { beginNearbyJoin(nearbyCode); setJoinOpen(false); setNearbyCode(''); } }} className="space-y-5">
            <div className="space-y-2">
              <Label id="nearby-code-label" className="section-label">{t('nearbyCodeLabel')}</Label>
              <div className="grid grid-cols-6 gap-2 sm:gap-3" role="group" aria-labelledby="nearby-code-label">
                {Array.from({ length: 6 }, (_, index) => (
                  <Input
                    key={index}
                    ref={element => { nearbyCodeInputs.current[index] = element; }}
                    aria-label={t('nearbyCodeDigit', { index: index + 1 })}
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={nearbyCode[index]?.trim() || ''}
                    onFocus={event => event.currentTarget.select()}
                    onChange={event => {
                      if (!event.target.value) { clearNearbyDigit(index); return; }
                      setNearbyDigits(index, event.target.value);
                    }}
                    onPaste={event => { event.preventDefault(); setNearbyDigits(index, event.clipboardData.getData('text')); }}
                    onKeyDown={event => {
                      if (event.key === 'Backspace' && !nearbyCode[index]?.trim() && index > 0) {
                        event.preventDefault();
                        clearNearbyDigit(index - 1);
                        nearbyCodeInputs.current[index - 1]?.focus();
                      }
                      if (event.key === 'ArrowLeft' && index > 0) nearbyCodeInputs.current[index - 1]?.focus();
                      if (event.key === 'ArrowRight' && index < 5) nearbyCodeInputs.current[index + 1]?.focus();
                    }}
                    className="app-input amount h-14 min-w-0 px-0 text-center text-xl"
                  />
                ))}
              </div>
            </div>
            <p className="flex items-start gap-2 border-t border-border pt-4 text-sm leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />{t('joinSyncTrust')}</p>
            <div className="border-t border-border pt-4"><Button type="submit" disabled={!/^\d{6}$/.test(nearbyCode)} className="app-button-primary h-11 w-full">{t('joinSync')}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <div className={`dashboard-overview-grid${recent.length ? '' : ' dashboard-overview-grid--single'}`}>
        {groups.length > 0 ? (
          <section aria-labelledby="group-collection-title">
          <div className="collection-section-heading"><h2 id="group-collection-title" className="text-lg font-semibold">{t('yourGroups')}</h2></div>
          <div className="collection-grid">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
          </section>
        ) : (
          <section className="app-surface px-6 py-10 sm:px-10 sm:py-12" aria-labelledby="first-group-title">
            <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
              <div>
                <div className="icon-tile mb-6 grid h-12 w-12 place-items-center">
                  <CircleDollarSign className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 id="first-group-title" className="max-w-md text-2xl font-semibold tracking-tight text-foreground">{t('firstGroupTitle')}</h3>
                <p className="mt-3 max-w-xl text-muted-foreground">{t('firstGroupBody')}</p>
                <Button onClick={() => navigate('/create-group')} className="app-button-primary mt-6 gap-2">
                  <Plus className="h-4 w-4" />{t('createFirstGroup')}
                </Button>
              </div>
              <ol className="space-y-3 border-t border-border pt-5 text-sm sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                {[t('firstGroupStepOne'), t('firstGroupStepTwo'), t('firstGroupStepThree')].map((step, index) => (
                  <li key={step} className="flex items-start gap-3 text-muted-foreground">
                    <span className="amount grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border text-xs text-foreground">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}
        {recent.length > 0 && <section className="dashboard-activity"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">{t('recentActivity')}</h2><Button variant="ghost" onClick={() => navigate('/activity')} className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground">{t('viewAll')} <ArrowRight className="ml-1 h-4 w-4" /></Button></div><div className="divide-y divide-border app-surface px-4">{recent.map(expense => <button key={expense.id} onClick={() => navigate(`/group/${expense.groupId}`)} className="flex w-full items-center justify-between gap-4 py-4 text-left"><div className="min-w-0"><p className="truncate font-medium">{expense.description}</p><p className="mt-0.5 text-sm text-muted-foreground">{expense.groupName}</p></div><p className="amount shrink-0 font-medium">{formatVnd(expense.amount)}</p></button>)}</div></section>}
      </div>
    </Layout>
  );
};

export default Dashboard;
