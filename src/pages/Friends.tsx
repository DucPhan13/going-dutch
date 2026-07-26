import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, UserPlus, Users } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { useGroupContext } from '@/contexts/GroupContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Avatar from '@/components/ui/Avatar';

export default function Friends() {
  const navigate = useNavigate(); const { groups, addMemberToGroup } = useGroupContext(); const [name, setName] = useState(''); const [groupId, setGroupId] = useState(groups[0]?.id || '');
  const people = useMemo(() => Object.values(groups.flatMap(group => group.members.map(member => ({ ...member, groupName: group.name, groupId: group.id }))).reduce<Record<string, {id:string; name:string; groupName:string; groupId:string}>>((result, member) => ({ ...result, [member.name.toLowerCase()]: result[member.name.toLowerCase()] || member }), {})), [groups]);
  const addFriend = (event: React.FormEvent) => { event.preventDefault(); if (!name.trim() || !groupId) return; addMemberToGroup(groupId, name); setName(''); };
  return <Layout title="Going Dutch"><section className="mb-8"><p className="section-label mb-2">Your people</p><h1 className="text-3xl font-semibold tracking-tight">Friends</h1><p className="mt-2 text-muted-foreground">People you split expenses with, across every group.</p></section>
    {groups.length ? <form onSubmit={addFriend} className="app-surface-strong mb-8 grid gap-3 p-4 sm:grid-cols-[1fr_190px_auto]"><Input className="app-input h-11" value={name} onChange={event => setName(event.target.value)} placeholder="Friend’s name" /><Select value={groupId} onValueChange={setGroupId}><SelectTrigger className="app-input h-11"><SelectValue placeholder="Choose a group" /></SelectTrigger><SelectContent>{groups.map(group => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}</SelectContent></Select><Button className="app-button-primary h-11 gap-2" type="submit"><UserPlus className="h-4 w-4" />Add friend</Button></form> : null}
    {people.length ? <div className="divide-y divide-border app-surface px-5">{people.map(person => <button key={person.id} onClick={() => navigate(`/group/${person.groupId}`)} className="flex w-full items-center gap-3 py-4 text-left"><Avatar name={person.name} className="h-10 w-10" /><div className="min-w-0 flex-1"><p className="font-semibold">{person.name}</p><p className="mt-0.5 text-sm text-muted-foreground">In {person.groupName}</p></div><span className="text-sm text-muted-foreground">View group</span></button>)}</div> : <div className="app-surface flex flex-col items-center px-6 py-16 text-center"><div className="icon-tile mb-5 grid h-14 w-14 place-items-center"><Users className="h-6 w-6 text-muted-foreground" /></div><h2 className="text-xl font-semibold">Your friends will appear here</h2><p className="mt-2 max-w-sm text-muted-foreground">Create a group first, then add the people you share expenses with.</p><Button onClick={() => navigate('/create-group')} className="app-button-primary mt-6 gap-2"><Plus className="h-4 w-4" />Create a group</Button></div>}
  </Layout>;
}
