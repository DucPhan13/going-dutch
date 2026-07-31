import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupContext } from '@/contexts/GroupContext';
import Layout from '@/components/layout/Layout';
import GroupCard from '@/components/groups/GroupCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ArrowRight, CircleDollarSign, Plus, ReceiptText, Users, Wifi } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { beginNearbyJoin, groups } = useGroupContext();
  const [joinOpen, setJoinOpen] = useState(false);
  const [nearbyCode, setNearbyCode] = useState('');

  const totalExpenses = groups.reduce((sum, g) => sum + g.expenses.length, 0);
  const totalMembers = groups.reduce((sum, g) => sum + g.members.length, 0);
  const totalSpent = groups.reduce((sum, g) => {
    return sum + g.expenses.reduce((s, e) => s + e.amount, 0);
  }, 0);

  const recent = groups.flatMap(group => group.expenses.map(expense => ({ ...expense, groupName: group.name, groupId: group.id }))).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).slice(0, 4);

  return (
    <Layout title="Going Dutch">
      <section className="mb-8 flex items-end justify-between gap-4">
        <div><p className="section-label mb-2">Shared spending, clearly</p><h2 className="text-3xl font-semibold tracking-tight text-foreground">Your groups</h2></div>
        <div className="flex shrink-0 gap-2"><Button variant="outline" onClick={() => setJoinOpen(true)} className="gap-2"><Wifi className="h-4 w-4" /><span className="hidden sm:inline">Join sync</span></Button><Button onClick={() => navigate('/create-group')} className="app-button-primary gap-2"><Plus className="h-4 w-4" /><span className="hidden sm:inline">New group</span></Button></div>
      </section>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}><DialogContent><DialogHeader><DialogTitle>Join nearby sync</DialogTitle><DialogDescription>Enter the six-digit code shown on the other device. The code expires after 60 seconds.</DialogDescription></DialogHeader><form onSubmit={event => { event.preventDefault(); if (/^\d{6}$/.test(nearbyCode)) { beginNearbyJoin(nearbyCode); setJoinOpen(false); setNearbyCode(''); } }} className="space-y-4"><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={nearbyCode} onChange={event => setNearbyCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="text-center font-mono text-xl tracking-[0.35em]" /><DialogFooter><Button type="submit" disabled={!/^\d{6}$/.test(nearbyCode)} className="app-button-primary">Join sync</Button></DialogFooter></form></DialogContent></Dialog>

      {groups.length > 0 && <section className="app-surface-strong mb-8 grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:p-6">
        <div><p className="section-label mb-2">Total shared spending</p><p className="amount text-3xl font-semibold text-foreground sm:text-4xl">{totalSpent.toLocaleString('vi-VN')} <span className="text-lg text-muted-foreground">đ</span></p><p className="mt-2 text-sm text-muted-foreground">Across {groups.length} groups and {totalExpenses} expenses.</p></div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-52"><div className="app-surface p-3"><Users className="mb-4 h-4 w-4 balance-positive" /><p className="text-xl font-semibold">{totalMembers}</p><p className="text-xs text-muted-foreground">people</p></div><div className="app-surface p-3"><ReceiptText className="mb-4 h-4 w-4 balance-positive" /><p className="text-xl font-semibold">{totalExpenses}</p><p className="text-xs text-muted-foreground">expenses</p></div></div>
      </section>}

      {/* Group Grid */}
      {groups.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      ) : (
        <div className="app-surface mt-8 flex flex-col items-center px-6 py-16 text-center">
          <div className="icon-tile mb-6 grid h-16 w-16 place-items-center">
            <CircleDollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">No groups yet</h3>
          <p className="mb-8 w-full max-w-xs text-muted-foreground">
            Create a group to start tracking shared expenses with friends or roommates.
          </p>
          <Button
            onClick={() => navigate('/create-group')}
            className="app-button-primary gap-2"
          >
            <Plus className="w-4 h-4" /> Create your first group
          </Button>
        </div>
      )}
      {recent.length > 0 && <section className="mt-10"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Recent activity</h2><Button variant="ghost" onClick={() => navigate('/activity')} className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground">View all <ArrowRight className="ml-1 h-4 w-4" /></Button></div><div className="divide-y divide-border app-surface px-4">{recent.map(expense => <button key={expense.id} onClick={() => navigate(`/group/${expense.groupId}`)} className="flex w-full items-center justify-between gap-4 py-4 text-left"><div className="min-w-0"><p className="truncate font-medium">{expense.description}</p><p className="mt-0.5 text-sm text-muted-foreground">{expense.groupName}</p></div><p className="amount shrink-0 font-medium">{expense.amount.toLocaleString('vi-VN')} đ</p></button>)}</div></section>}
    </Layout>
  );
};

export default Dashboard;
