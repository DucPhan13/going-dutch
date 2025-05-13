
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupContext } from '@/contexts/GroupContext';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

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
      <div className="max-w-md mx-auto">
        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Create a new group</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Group Name
                  </label>
                  <Input
                    id="name"
                    placeholder="Trip to Paris, Apartment, etc."
                    value={groupName}
                    onChange={(e) => {
                      setGroupName(e.target.value);
                      setError('');
                    }}
                    className={error ? "border-red-500" : ""}
                  />
                  {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Create Group
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </Layout>
  );
};

export default CreateGroup;
