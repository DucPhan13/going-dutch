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

const splitOptions = [
  { value: 'equal', label: 'Equally' }, { value: 'unequal', label: 'Unequally' },
  { value: 'shares', label: 'By shares' }, { value: 'percentage', label: 'By percentage' }, { value: 'exact', label: 'By exact amount' },
] as const;

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
  if (!currentGroup) return <Layout title="Expense" showBack><div className="app-surface p-8 text-center text-muted-foreground">This group is no longer available.</div></Layout>;

  const selected = currentGroup.members.filter(member => participants[member.id]);
  const setError = (name: string) => setErrors(current => { const next = { ...current }; delete next[name]; return next; });
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); const nextErrors: Record<string, string> = {}; const parsedAmount = parseVndAmount(amount);
    if (!description.trim()) nextErrors.description = 'Add a short description.';
    if (parsedAmount === null) nextErrors.amount = 'Enter a whole amount greater than zero.';
    if (!isCalendarDate(date)) nextErrors.date = 'Choose a valid calendar date.';
    if (!paidBy) nextErrors.paidBy = 'Choose who paid.';
    if (!selected.length) nextErrors.participants = 'Choose at least one person.';
    const numericValues = Object.fromEntries(Object.entries(splitValues).map(([key, value]) => [key, splitType === 'exact' ? parseVndAmount(value) : Number(value) || 0]));
    if (splitType === 'exact' && Object.values(numericValues).some(value => value === null)) nextErrors.split = 'Enter a whole amount for every selected person.';
    if (splitType === 'exact' && selected.length && parsedAmount !== null && Math.abs(Object.values(numericValues).reduce<number>((sum, value) => sum + (typeof value === 'number' ? value : 0), 0) - parsedAmount) !== 0) nextErrors.split = 'Exact amounts must add up to the total.';
    if (splitType === 'percentage' && selected.length && Math.abs(Object.values(numericValues).reduce((sum, value) => sum + value, 0) - 100) > 0.1) nextErrors.split = 'Percentages must add up to 100.';
    setErrors(nextErrors); if (Object.keys(nextErrors).length) return;
    if (parsedAmount === null) return;
    const expense: Omit<Expense, 'id'> = { description: description.trim(), amount: parsedAmount, paidBy, participants: selected.map(member => member.id), date, category, notes: notes.trim() || undefined, receiptData: receiptData || undefined, splitType, splitValues: splitType === 'equal' ? undefined : numericValues as Record<string, number> };
    if (editingExpenseId) editExpense(editingExpenseId, expense);
    else addExpense(expense);
    navigate(`/group/${currentGroup.id}`);
  };
  const valueLabel = splitType === 'percentage' ? '%' : splitType === 'shares' ? 'shares' : splitType === 'exact' ? 'đ' : 'weight';
  return <Layout title={editingExpenseId ? 'Edit expense' : 'Add expense'} showBack backTo={`/group/${currentGroup.id}`}>
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
      <section className="app-surface-strong p-5 sm:p-7"><div className="mb-6 flex items-center gap-3"><div className="icon-tile grid h-11 w-11 place-items-center"><ReceiptText className="h-5 w-5 balance-positive" /></div><div><p className="section-label">{currentGroup.name}</p><h2 className="text-xl font-semibold">What was this for?</h2></div></div>
        <div className="grid gap-5 sm:grid-cols-[1fr_180px]"><div><Label htmlFor="description">Description</Label><Input id="description" className="app-input mt-2 h-12" placeholder="Dinner, groceries, tickets…" value={description} onChange={event => { setDescription(event.target.value); setError('description'); }} />{errors.description && <p className="mt-2 text-sm text-destructive">{errors.description}</p>}</div><div><Label htmlFor="amount">Amount</Label><div className="relative mt-2"><Input id="amount" type="number" inputMode="numeric" step="1" className="app-input h-12 pr-9 amount" placeholder="0" value={amount} onChange={event => { setAmount(event.target.value); setError('amount'); }} onBlur={() => { const value = parseVndAmount(amount); if (value !== null) setAmount(String(value)); }} /><span className="absolute right-3 top-3 text-sm text-muted-foreground">đ</span></div><p className="mt-1 text-xs text-muted-foreground">Numbers below 1,000 are treated as thousands: 30 becomes 30,000 đ.</p>{errors.amount && <p className="mt-2 text-sm text-destructive">{errors.amount}</p>}</div></div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2"><div><Label>Paid by</Label><Select value={paidBy} onValueChange={value => { setPaidBy(value); setError('paidBy'); }}><SelectTrigger className="app-input mt-2 h-11"><SelectValue placeholder="Choose a payer" /></SelectTrigger><SelectContent>{currentGroup.members.map(member => <SelectItem value={member.id} key={member.id}>{member.name}</SelectItem>)}</SelectContent></Select>{errors.paidBy && <p className="mt-2 text-sm text-destructive">{errors.paidBy}</p>}</div><div><Label htmlFor="date">Date</Label><div className="relative mt-2"><CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="date" type="date" className="app-input h-11 pl-9" value={date} onChange={event => { setDate(event.target.value); setError('date'); }} /></div>{errors.date && <p className="mt-2 text-sm text-destructive">{errors.date}</p>}</div></div>
      </section>
      <section className="app-surface p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><div><p className="section-label">Split details</p><h2 className="mt-1 text-xl font-semibold">How should this be split?</h2></div><Users className="h-5 w-5 text-muted-foreground" /></div>
        <Select value={splitType} onValueChange={value => { setSplitType(value as Expense['splitType']); setError('split'); }}><SelectTrigger className="app-input h-12"><SelectValue /></SelectTrigger><SelectContent>{splitOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
        <div className="mt-4 divide-y divide-border rounded-xl border border-border px-4">{currentGroup.members.map(member => <label key={member.id} className="flex min-h-14 items-center gap-3 py-3"><Checkbox checked={!!participants[member.id]} onCheckedChange={() => { setParticipants(current => ({ ...current, [member.id]: !current[member.id] })); setError('participants'); }} /><Avatar name={member.name} className="h-8 w-8 text-xs" /><span className="min-w-0 flex-1 font-medium">{member.name}</span>{participants[member.id] && splitType !== 'equal' && <div className="relative w-24"><Input aria-label={`${member.name} ${valueLabel}`} className="app-input h-9 pr-7 text-right amount" type="number" inputMode="numeric" step={splitType === 'percentage' ? 'any' : '1'} min="0" placeholder={splitType === 'percentage' ? '0' : '1'} value={splitValues[member.id] || ''} onChange={event => setSplitValues(current => ({ ...current, [member.id]: event.target.value }))} onBlur={() => { if (splitType !== 'exact') return; const value = parseVndAmount(splitValues[member.id]); if (value !== null) setSplitValues(current => ({ ...current, [member.id]: String(value) })); }} /><span className="absolute right-2 top-2 text-[10px] text-muted-foreground">{valueLabel}</span></div>}</label>)}</div>
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground"><span>{selected.length} of {currentGroup.members.length} people included</span>{splitType === 'equal' && selected.length > 0 && <span>≈ {(Number(amount || 0) / selected.length).toLocaleString('vi-VN')} đ each</span>}</div>{errors.participants && <p className="mt-2 text-sm text-destructive">{errors.participants}</p>}{errors.split && <p className="mt-2 text-sm text-destructive">{errors.split}</p>}</section>
      <section className="app-surface p-5 sm:p-7"><div className="mb-5 flex items-center gap-3"><FileText className="h-5 w-5 text-muted-foreground" /><div><p className="section-label">Optional</p><h2 className="text-lg font-semibold">Make it easier to find later</h2></div></div><div className="grid gap-5 sm:grid-cols-2"><div><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger className="app-input mt-2 h-11"><SelectValue /></SelectTrigger><SelectContent>{['General', 'Food & drinks', 'Home', 'Transport', 'Travel', 'Entertainment'].map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="notes">Notes</Label><Textarea id="notes" className="app-input mt-2 min-h-11" placeholder="Add a note" value={notes} onChange={event => setNotes(event.target.value)} /></div><div className="sm:col-span-2"><Label htmlFor="receipt">Receipt photo</Label><label className="app-input mt-2 flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm text-muted-foreground"><ImagePlus className="h-4 w-4" /><span className="truncate">{isPreparingReceipt ? 'Preparing receipt…' : receiptData ? 'Receipt attached' : 'Attach a photo (optional)'}</span><input id="receipt" className="sr-only" type="file" accept="image/*" disabled={isPreparingReceipt} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setIsPreparingReceipt(true); void prepareReceipt(file).then(data => { const otherReceipts = currentGroup.expenses.filter(expense => expense.id !== editingExpenseId).reduce((total, expense) => total + (expense.receiptData?.length || 0), 0); if (otherReceipts + data.length > MAX_GROUP_RECEIPT_BYTES) throw new Error(`This group can store up to ${(MAX_GROUP_RECEIPT_BYTES / 1024 / 1024).toFixed(0)} MB of receipt data.`); setReceiptData(data); setError('receipt'); }).catch(error => setErrors(current => ({ ...current, receipt: error instanceof Error ? error.message : 'Receipt could not be processed.' }))).finally(() => setIsPreparingReceipt(false)); }} /></label><p className="mt-2 text-xs text-muted-foreground">Images up to {(MAX_RECEIPT_FILE_BYTES / 1024 / 1024).toFixed(0)} MB are resized, re-encoded, and stripped of photo metadata before they are stored. This group can store up to {(MAX_GROUP_RECEIPT_BYTES / 1024 / 1024).toFixed(0)} MB of receipts. Receipts are included in encrypted backup and sync files.</p>{errors.receipt && <p className="mt-2 text-sm text-destructive">{errors.receipt}</p>}{receiptData && <Button type="button" variant="ghost" className="mt-2 h-auto px-0 text-sm" onClick={() => setReceiptData('')}>Remove receipt</Button>}</div></div></section>
      <div className="sticky bottom-3 z-20 flex justify-end"><Button type="submit" className="app-button-primary h-12 min-w-40 px-6">{editingExpenseId ? 'Save changes' : 'Save expense'}</Button></div>
    </form>
  </Layout>;
}
