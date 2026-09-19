import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupContext } from '@/contexts/GroupContext';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';
import { usePreferences } from '@/contexts/PreferencesContext';

const CreateGroup = () => {
  const [groupName, setGroupName] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { createGroup } = useGroupContext();
  const { t } = usePreferences();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!groupName.trim()) {
      setError(t('groupNameEmpty'));
      return;
    }

    createGroup(groupName, memberNames);
    navigate('/');
  };

  const addMembers = () => {
    const additions = memberInput.split(',').map(name => name.trim()).filter(Boolean);
    if (!additions.length) return;
    setMemberNames(current => {
      const known = new Set(current.map(name => name.toLocaleLowerCase()));
      return [...current, ...additions.filter(name => {
        const normalized = name.toLocaleLowerCase();
        if (known.has(normalized)) return false;
        known.add(normalized);
        return true;
      })];
    });
    setMemberInput('');
  };

  return (
    <Layout title={t('appName')} showBack>
      <div className="create-group-flow">
        <div className="create-group-heading">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t('createGroupHeading')}
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {t('startTracking')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="create-group-form mt-8">
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-foreground">
              {t('groupName')}
            </Label>
            <div className="mt-2">
              <Input
                id="name"
                placeholder={t('groupPlaceholder')}
                value={groupName}
                onChange={(e) => {
                  setGroupName(e.target.value);
                  setError('');
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'group-name-error' : undefined}
                className={`app-input h-12 text-base ${error ? 'border-destructive' : ''}`}
              />
            </div>
            {error && <p id="group-name-error" className="mt-2 text-sm text-destructive">{error}</p>}
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <Label htmlFor="members" className="text-sm font-medium text-foreground">{t('addMembers')}</Label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Input
                id="members"
                placeholder={t('addMemberPlaceholder')}
                value={memberInput}
                onChange={(event) => setMemberInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addMembers();
                  }
                }}
                className="app-input h-12 flex-1 text-base"
              />
              <Button type="button" variant="outline" onClick={addMembers} className="h-12 gap-2 px-4 sm:shrink-0">
                <Plus className="h-4 w-4" />
                {t('add')}
              </Button>
            </div>
            {memberNames.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label={t('members')}>
                {memberNames.map((memberName) => (
                  <li key={memberName} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary px-3 py-1 text-sm text-foreground">
                    <span className="truncate">{memberName}</span>
                    <button type="button" onClick={() => setMemberNames(current => current.filter(name => name !== memberName))} className="ml-1 rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${t('remove')} ${memberName}`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-6 flex justify-end">
            <Button type="submit" className="app-button-primary h-12 px-5 text-base font-medium">
              {t('createGroup')}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default CreateGroup;
