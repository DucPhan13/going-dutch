import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupContext } from '@/contexts/GroupContext';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Users } from 'lucide-react';

const CreateGroup = () => {
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { createGroup } = useGroupContext();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!groupName.trim()) {
      setError('Please enter a group name');
      return;
    }

    createGroup(groupName);
    navigate('/');
  };

  return (
    <Layout title="Create Group" showBack>
      <div className="max-w-md mx-auto animate-scale-in">
        <Card className="glass-card">
          <form onSubmit={handleSubmit}>
            <CardContent className="pt-6 pb-6">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                <Users className="w-7 h-7 text-emerald-400" />
              </div>

              <h2 className="text-lg font-semibold text-center text-foreground mb-1">
                Create a new group
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Start tracking shared expenses
              </p>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm text-muted-foreground">
                    Group name
                  </Label>
                  <Input
                    id="name"
                    placeholder="Trip to Da Lat, Apartment, etc."
                    value={groupName}
                    onChange={(e) => {
                      setGroupName(e.target.value);
                      setError('');
                    }}
                    className={`mt-2 ${error ? "border-red-500" : ""}`}
                  />
                  {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-11 text-base font-medium active:scale-[0.98]"
              >
                Create group
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </Layout>
  );
};

export default CreateGroup;
