
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupContext } from '@/contexts/GroupContext';
import Layout from '@/components/layout/Layout';
import GroupCard from '@/components/groups/GroupCard';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { groups } = useGroupContext();
  
  return (
    <Layout title="Going Dutch">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-xl font-semibold">Your Groups</h2>
        <Button onClick={() => navigate('/create-group')} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> Create Group
        </Button>
      </div>

      {groups.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-700 mb-2">No groups yet</h3>
          <p className="text-gray-500 mb-6">Create a group to start tracking expenses</p>
          <Button onClick={() => navigate('/create-group')} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" /> Create Your First Group
          </Button>
        </div>
      )}
    </Layout>
  );
};

export default Dashboard;
