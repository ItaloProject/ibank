export type TransactionCategory =
  | "alimentacao"
  | "transporte"
  | "saude"
  | "lazer"
  | "educacao"
  | "moradia"
  | "vestuario"
  | "outros";

export type InvestmentType = "deposito" | "retirada" | "rendimento";

export interface CreditCard {
  id: string;
  name: string;
  limit: number;
  closing_day: number;
  due_day: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  credit_card_id: string;
  description: string;
  amount: number;
  category: TransactionCategory;
  date: string;
  installments: number;
  installment_current: number;
  created_at: string;
}

export interface InvestmentAccount {
  id: string;
  name: string;
  institution: string;
  current_balance: number;
  created_at: string;
}

export interface Investment {
  id: string;
  account_id: string;
  type: InvestmentType;
  amount: number;
  description: string;
  date: string;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      credit_cards: {
        Row: CreditCard;
        Insert: {
          id?: string;
          name: string;
          limit: number;
          closing_day: number;
          due_day: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          limit?: number;
          closing_day?: number;
          due_day?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: Transaction;
        Insert: {
          id?: string;
          credit_card_id: string;
          description: string;
          amount: number;
          category: TransactionCategory;
          date: string;
          installments?: number;
          installment_current?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          credit_card_id?: string;
          description?: string;
          amount?: number;
          category?: TransactionCategory;
          date?: string;
          installments?: number;
          installment_current?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      investment_accounts: {
        Row: InvestmentAccount;
        Insert: {
          id?: string;
          name: string;
          institution?: string;
          current_balance?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          institution?: string;
          current_balance?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      investments: {
        Row: Investment;
        Insert: {
          id?: string;
          account_id: string;
          type: InvestmentType;
          amount: number;
          description?: string;
          date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          type?: InvestmentType;
          amount?: number;
          description?: string;
          date?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
