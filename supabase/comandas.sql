-- Comanda de mesa: uma conta aberta por mesa. Cada rodada de itens vira um pedido ligado à comanda.
-- Sem política de acesso: só o servidor do IBANK lê e grava.
create table if not exists public.comandas (
  id uuid primary key default gen_random_uuid(),
  pizzaria_slug text not null,
  mesa text not null check (char_length(mesa) between 1 and 20),
  status text not null default 'aberta' check (status in ('aberta', 'fechada')),
  pagamento text,
  troco text not null default '',
  total numeric,
  aberta_em timestamptz not null default now(),
  fechada_em timestamptz
);

-- Só uma comanda aberta por mesa em cada pizzaria
create unique index if not exists comandas_mesa_aberta_idx on public.comandas (pizzaria_slug, mesa) where status = 'aberta';

alter table public.comandas enable row level security;

alter table public.pedidos add column if not exists comanda_id uuid references public.comandas (id) on delete set null;
