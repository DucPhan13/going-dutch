
import React from 'react';
import { Button } from '@/components/ui/button';
import { Balance } from '@/types';
import { Check } from 'lucide-react';
import { useGroupContext } from '@/contexts/GroupContext';

interface BalanceActionsProps {
  balance: Balance;
}

export default function BalanceActions({ balance }: BalanceActionsProps) {
  const { markBalanceAsPaid } = useGroupContext();
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => markBalanceAsPaid(balance)}
      className="text-green-500 border-green-500 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900"
    >
      <Check className="mr-1 h-4 w-4" />
      Mark Paid
    </Button>
  );
}
