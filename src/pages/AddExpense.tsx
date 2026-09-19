import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, FileText, ImagePlus, ReceiptText, Users } from 'lucide-react';
import { useGroupContext } from '@/contexts/GroupContext';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import Avatar from '@/components/ui/avatar';
import { Expense } from '@/types';
import { isCalendarDate } from '@/lib/calendar-date';
import { parseVndAmount } from '@/lib/money';
import { prepareReceipt, MAX_GROUP_RECEIPT_BYTES, MAX_RECEIPT_FILE_BYTES } from '@/lib/receipt';
import { usePreferences } from '@/contexts/PreferencesContext';

const localToday = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
};

export default function AddExpense() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { selectGroup, currentGroup, addExpense, editExpense } = useGroupContext();
  const { t, formatVnd } = usePreferences();
  const [description, setDescription] = useState(''); const [amount, setAmount] = useState(''); const [paidBy, setPaidBy] = useState('');
  const [date, setDate] = useState(localToday); const [category, setCategory] = useState('General'); const [notes, setNotes] = useState(''); const [receiptData, setReceiptData] = useState('');
  const [splitType, setSplitType] = useState<Expense['splitType']>('equal'); const [participants, setParticipants] = useState<Record<string, boolean>>({}); const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({}); const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null); const [isPreparingReceipt, setIsPreparingReceipt] = useState(false);

  useEffect(() => { if (id) selectGroup(id); }, [id, selectGroup]);
  useEffect(() => {
    if (!currentGroup) return;
    const editId = new URLSearchParams(location.search).get('edit'); const existing = editId ? currentGroup.expenses.find(expense => expense.id === editId) : undefined;
    const active = existing?.participants || currentGroup.members.map(member => member.id);
    setParticipants(Object.fromEntries(currentGroup.members.map(member => [member.id, active.includes(member.id)])));
    setPaidBy(existing?.paidBy || currentGroup.members[0]?.id || '');
    if (existing) { setEditingExpenseId(existing.id); setDescription(existing.description); setAmount(String(existing.amount)); setDate((existing.date || localToday()).slice(0, 10)); setCategory(existing.category || 'General'); setNotes(existing.notes || ''); setReceiptData(existing.receiptData || ''); setSplitType(existing.splitType || 'equal'); setSplitValues(Object.fromEntries(Object.entries(existing.splitValues || {}).map(([key, value]) => [key, String(value)]))); }
  }, [currentGroup, location.search]);
  if (!currentGroup) return <Layout title={t('expense')} showBack><div className="app-surface p-8 text-center text-muted-foreground">{t('paymentUnavailable')}</div></Layout>;

  const selected = currentGroup.members.filter(member => participants[member.id]);
  const setError = (name: string) => setErrors(current => { const next = { ...current }; delete next[name]; return next; });
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); const nextErrors: Record<string, string> = {}; const parsedAmount = parseVndAmount(amount);
    if (!description.trim()) nextErrors.description = t('descriptionError');
    if (parsedAmount === null) nextErrors.amount = t('amountError');
    if (!isCalendarDate(date)) nextErrors.date = t('dateError');
    if (!paidBy) nextErrors.paidBy = t('payerError');
    if (!selected.length) nextErrors.participants = t('participantsError');
    const numericValues = Object.fromEntries(Object.entries(splitValues).map(([key, value]) => [key, splitType === 'exact' ? parseVndAmount(value) : Number(value) || 0]));
    if (splitType === 'exact' && Object.values(numericValues).some(value => value === null)) nextErrors.split = t('exactAmountError');
    if (splitType === 'exact' && selected.length && parsedAmount !== null && Math.abs(Object.values(numericValues).reduce<number>((sum, value) => sum + (typeof value === 'number' ? value : 0), 0) - parsedAmount) !== 0) nextErrors.split = t('exactTotalError');
    if (splitType === 'percentage' && selected.length && Math.abs(Object.values(numericValues).reduce((sum, value) => sum + value, 0) - 100) > 0.1) nextErrors.split = t('percentageTotalError');
    setErrors(nextErrors); if (Object.keys(nextErrors).length) return;
    if (parsedAmount === null) return;
    const expense: Omit<Expense, 'id'> = { description: description.trim(), amount: parsedAmount, paidBy, participants: selected.map(member => member.id), date, category, notes: notes.trim() || undefined, receiptData: receiptData || undefined, splitType, splitValues: splitType === 'equal' ? undefined : numericValues as Record<string, number> };
    if (editingExpenseId) editExpense(editingExpenseId, expense);
    else addExpense(expense);
    navigate(`/group/${currentGroup.id}${editingExpenseId ? '' : '?view=balances'}`);
  };
  const splitOptions = [{ value: 'equal', label: t('splitEqual') }, { value: 'unequal', label: t('splitUnequal') }, { value: 'shares', label: t('splitByShares') }, { value: 'percentage', label: t('splitByPercentage') }, { value: 'exact', label: t('splitByExactAmount') }] as const;
  const valueLabel = splitType === 'percentage' ? '%' : splitType === 'shares' ? t('shares') : splitType === 'exact' ? 'đ' : t('weight');
  return <Layout title={editingExpenseId ? t('editExpense') : t('addExpense')} showBack backTo={`/group/${currentGroup.id}`}>
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
      <section className="app-surface-strong p-5 sm:p-7"><div className="mb-6 flex items-center gap-3"><div className="icon-tile grid h-11 w-11 place-items-center"><ReceiptText className="h-5 w-5 balance-positive" /></div><div><p className="section-label">{currentGroup.name}</p><h2 className="text-xl font-semibold">{t('whatWasThisFor')}</h2></div></div>
        <div className="grid gap-5 sm:grid-cols-[1fr_180px]"><div><Label htmlFor="description">{t('description')}</Label><Input id="description" className="app-input mt-2 h-12" placeholder={t('expensePlaceholder')} value={description} onChange={event => { setDescription(event.target.value); setError('description'); }} />{errors.description && <p className="mt-2 text-sm text-destructive">{errors.description}</p>}</div><div><Label htmlFor="amount">{t('amount')}</Label><div className="relative mt-2"><Input id="amount" type="number" inputMode="numeric" step="1" className="app-input h-12 pr-9 amount" placeholder="0" value={amount} onChange={event => { setAmount(event.target.value); setError('amount'); }} onBlur={() => { const value = parseVndAmount(amount); if (value !== null) setAmount(String(value)); }} /><span className="absolute right-3 top-3 text-sm text-muted-foreground">đ</span></div><p className="mt-1 text-xs text-muted-foreground">{t('amountHelp')}</p>{errors.amount && <p className="mt-2 text-sm text-destructive">{errors.amount}</p>}</div></div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2"><div><Label>{t('paidBy')}</Label><Select value={paidBy} onValueChange={value => { setPaidBy(value); setError('paidBy'); }}><SelectTrigger className="app-input mt-2 h-11"><SelectValue placeholder={t('choosePayer')} /></SelectTrigger><SelectContent>{currentGroup.members.map(member => <SelectItem value={member.id} key={member.id}>{member.name}</SelectItem>)}</SelectContent></Select>{errors.paidBy && <p className="mt-2 text-sm text-destructive">{errors.paidBy}</p>}</div><div><Label htmlFor="date">{t('date')}</Label><div className="relative mt-2"><CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="date" type="date" className="app-input h-11 pl-9" value={date} onChange={event => { setDate(event.target.value); setError('date'); }} /></div>{errors.date && <p className="mt-2 text-sm text-destructive">{errors.date}</p>}</div></div>
      </section>
      <section className="app-surface p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><div><p className="section-label">{t('splitDetails')}</p><h2 className="mt-1 text-xl font-semibold">{t('splitQuestion')}</h2></div><Users className="h-5 w-5 text-muted-foreground" /></div>
        <Select value={splitType} onValueChange={value => { setSplitType(value as Expense['splitType']); setError('split'); }}><SelectTrigger className="app-input h-12"><SelectValue /></SelectTrigger><SelectContent>{splitOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
        <div className="mt-4 divide-y divide-border rounded-xl border border-border px-4">{currentGroup.members.map(member => <label key={member.id} className="flex min-h-14 items-center gap-3 py-3"><Checkbox checked={!!participants[member.id]} onCheckedChange={() => { setParticipants(current => ({ ...current, [member.id]: !current[member.id] })); setError('participants'); }} /><Avatar name={member.name} className="h-8 w-8 text-xs" /><span className="min-w-0 flex-1 truncate font-medium">{member.name}</span>{participants[member.id] && splitType !== 'equal' && <div className="relative w-24 shrink-0"><Input aria-label={`${member.name} ${valueLabel}`} className="app-input h-9 pr-7 text-right amount" type="number" inputMode="numeric" step={splitType === 'percentage' ? 'any' : '1'} min="0" placeholder={splitType === 'percentage' ? '0' : '1'} value={splitValues[member.id] || ''} onChange={event => setSplitValues(current => ({ ...current, [member.id]: event.target.value }))} onBlur={() => { if (splitType !== 'exact') return; const value = parseVndAmount(splitValues[member.id]); if (value !== null) setSplitValues(current => ({ ...current, [member.id]: String(value) })); }} /><span className="absolute right-2 top-2 text-[10px] text-muted-foreground">{valueLabel}</span></div>}</label>)}</div>
        <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{t('peopleIncluded', { selected: selected.length, total: currentGroup.members.length })}</span>{splitType === 'equal' && selected.length > 0 && <span>≈ {formatVnd(Number(amount || 0) / selected.length)} {t('each')}</span>}</div>{errors.participants && <p className="mt-2 text-sm text-destructive">{errors.participants}</p>}{errors.split && <p className="mt-2 text-sm text-destructive">{errors.split}</p>}</section>
      <section className="app-surface p-5 sm:p-7"><div className="mb-5 flex items-center gap-3"><FileText className="h-5 w-5 text-muted-foreground" /><div><p className="section-label">{t('optional')}</p><h2 className="text-lg font-semibold">{t('findLater')}</h2></div></div><div className="grid gap-5 sm:grid-cols-2"><div><Label>{t('category')}</Label><Select value={category} onValueChange={setCategory}><SelectTrigger className="app-input mt-2 h-11"><SelectValue /></SelectTrigger><SelectContent>{[{ value: 'General', label: t('categoryGeneral') }, { value: 'Food & drinks', label: t('categoryFood') }, { value: 'Home', label: t('categoryHome') }, { value: 'Transport', label: t('categoryTransport') }, { value: 'Travel', label: t('categoryTravel') }, { value: 'Entertainment', label: t('categoryEntertainment') }].map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="notes">{t('notes')}</Label><Textarea id="notes" className="app-input mt-2 min-h-11" placeholder={t('addNote')} value={notes} onChange={event => setNotes(event.target.value)} /></div><div className="sm:col-span-2"><Label htmlFor="receipt">{t('receiptPhoto')}</Label><label className="app-input mt-2 flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm text-muted-foreground"><ImagePlus className="h-4 w-4" /><span className="truncate">{isPreparingReceipt ? t('preparingReceipt') : receiptData ? t('receiptAttached') : t('attachReceipt')}</span><input id="receipt" className="sr-only" type="file" accept="image/*" disabled={isPreparingReceipt} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setIsPreparingReceipt(true); void prepareReceipt(file).then(data => { const otherReceipts = currentGroup.expenses.filter(expense => expense.id !== editingExpenseId).reduce((total, expense) => total + (expense.receiptData?.length || 0), 0); if (otherReceipts + data.length > MAX_GROUP_RECEIPT_BYTES) throw new Error(t('receiptTooLarge', { limit: (MAX_GROUP_RECEIPT_BYTES / 1024 / 1024).toFixed(0) })); setReceiptData(data); setError('receipt'); }).catch(error => setErrors(current => ({ ...current, receipt: error instanceof Error ? error.message : t('receiptProcessError') }))).finally(() => setIsPreparingReceipt(false)); }} /></label><p className="mt-2 text-xs text-muted-foreground">{t('receiptHelp', { fileMb: (MAX_RECEIPT_FILE_BYTES / 1024 / 1024).toFixed(0), groupMb: (MAX_GROUP_RECEIPT_BYTES / 1024 / 1024).toFixed(0) })}</p>{errors.receipt && <p className="mt-2 text-sm text-destructive">{errors.receipt}</p>}{receiptData && <Button type="button" variant="ghost" className="mt-2 h-auto px-0 text-sm" onClick={() => setReceiptData('')}>{t('removeReceipt')}</Button>}</div></div></section>
      <div className="form-submit-bar sticky z-30 flex justify-end bg-background/95 py-3 backdrop-blur sm:bg-transparent sm:py-0 sm:backdrop-blur-none"><Button type="submit" className="app-button-primary h-12 min-w-40 px-6">{editingExpenseId ? t('saveChanges') : t('saveExpense')}</Button></div>
    </form>
  </Layout>;
}
