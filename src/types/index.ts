
export interface Member {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string; // member id
  date: string;
  participants: string[]; // member ids
}

export interface Group {
  id: string;
  name: string;
  members: Member[];
  expenses: Expense[];
}

export interface Balance {
  from: string;
  to: string;
  amount: number;
}
