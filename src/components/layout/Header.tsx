
import React from 'react';
import { Link } from 'react-router-dom';
import { useGroupContext } from '@/contexts/GroupContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  backTo?: string;
}

export default function Header({ title, showBack = false, backTo = "/" }: HeaderProps) {
  const { currentGroup } = useGroupContext();

  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-500 py-4 px-4 sm:px-6 flex items-center justify-between shadow-md">
      <div className="flex items-center">
        {showBack && (
          <Link to={backTo}>
            <Button variant="ghost" size="icon" className="mr-2 text-white hover:bg-blue-700">
              <ArrowLeft size={24} />
            </Button>
          </Link>
        )}
        <h1 className="text-xl sm:text-2xl font-bold text-white">{title}</h1>
        {currentGroup && title !== currentGroup.name && (
          <span className="ml-4 text-sm bg-blue-700 text-white rounded-full px-3 py-1">
            {currentGroup.name}
          </span>
        )}
      </div>
    </header>
  );
}
