export type InvestmentType = "deposito" | "retirada" | "rendimento";
export type StockTradeType = "compra" | "venda";

export interface InvestmentAccount {
  id: string;
  name: string;
  institution: string;
  current_balance: number;
  created_at: string;
  // TURBO fields
  is_turbo: boolean;
  cdi_percent: number | null;
  max_rendimento: number | null;
  valor_liquido: number | null;
  // Rentabilidade contratada (ver lib/account-rate)
  rate_index?: "cdi" | "selic" | "ipca" | "pre" | "poupanca" | null;
  rate_value?: number | null;
  maturity?: string | null;
  tax_exempt?: boolean | null;
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

export interface TurboRecord {
  id: string;
  account_id: string;
  user_id: string;
  month: string; // "YYYY-MM"
  total_bruto: number;
  rendimento: number;
  valor_liquido: number | null;
  created_at: string;
}

export interface PortfolioSnapshot {
  id: string;
  user_id: string;
  date: string; // "YYYY-MM-DD"
  total: number;
  invested: number;
  created_at: string;
}

export interface ScoreSnapshot {
  id: string;
  user_id: string;
  date: string; // "YYYY-MM-DD"
  score: number;
  created_at: string;
}

export interface StockTrade {
  id: string;
  user_id: string;
  ticker: string;
  type: StockTradeType;
  quantity: number;
  price_per_share: number;
  total_amount: number;
  notes: string;
  date: string;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
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
