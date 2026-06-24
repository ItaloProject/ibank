-- IBANK — Schema do banco de dados (PostgreSQL / Neon DB)
-- Execute este SQL no painel SQL do Neon (neon.tech → SQL Editor)

-- Cartões de crédito
create table if not exists credit_cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  "limit" numeric(12, 2) not null default 0,
  closing_day integer not null check (closing_day between 1 and 31),
  due_day integer not null check (due_day between 1 and 31),
  created_at timestamptz not null default now()
);

-- Transações do cartão
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  credit_card_id uuid not null references credit_cards(id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null,
  category text not null check (
    category in ('alimentacao','transporte','saude','lazer','educacao','moradia','vestuario','outros')
  ),
  date date not null,
  installments integer not null default 1,
  installment_current integer not null default 1,
  created_at timestamptz not null default now()
);

-- Contas de investimento / poupança
create table if not exists investment_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  institution text not null default '',
  current_balance numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- Movimentações de investimento
create table if not exists investments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references investment_accounts(id) on delete cascade,
  type text not null check (type in ('deposito', 'retirada', 'rendimento')),
  amount numeric(12, 2) not null,
  description text not null default '',
  date date not null,
  created_at timestamptz not null default now()
);

-- Índices
create index if not exists idx_transactions_card on transactions(credit_card_id);
create index if not exists idx_transactions_date on transactions(date);
create index if not exists idx_investments_account on investments(account_id);
create index if not exists idx_investments_date on investments(date);

-- Neon DB não usa RLS por padrão (sem autenticação necessária para uso pessoal)
-- O acesso é controlado pela connection string (DATABASE_URL)
