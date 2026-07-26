export interface Member {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  participants: string[];
  date?: string;
  category?: string;
  notes?: string;
  receiptData?: string;
  splitType?: 'equal' | 'unequal' | 'shares' | 'percentage' | 'exact';
  splitValues?: Record<string, number>;
}

export interface Balance {
  id: string;
  from: string;
  to: string;
  amount: number;
}

export interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  paidAt: string;
  originalBalanceId: string;
  paymentMethod?: string;
}

export interface Group {
  id: string;
  name: string;
  members: Member[];
  expenses: Expense[];
  transactions: Transaction[];
}
