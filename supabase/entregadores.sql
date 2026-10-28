-- Cadastro de entregadores do cardápio (uma lista por pizzaria).
-- Acesso só pela API do IBANK: RLS ligado e sem política, então o anon key não lê telefones.

create table if not exists public.entregadores (
  id uuid primary key default gen_random_uuid(),
  pizzaria_slug text not null,
  nome text not null,
  telefone text,
  veiculo text check (veiculo in ('moto', 'bike', 'carro')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index if not exists entregadores_pizzaria_idx on public.entregadores (pizzaria_slug);

alter table public.entregadores enable row level security;

-- Pedido de entrega ligado ao entregador que saiu com ele. Se o cadastro for apagado, o pedido fica sem entregador.
alter table public.pedidos add column if not exists entregador_id uuid references public.entregadores (id) on delete set null;
