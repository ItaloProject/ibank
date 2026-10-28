-- Conta os envios de pedido por origem (IP, guardado como hash), para limitar spam no pedido do cliente.
-- Sem política de acesso: só o servidor do IBANK lê e grava.
create table if not exists public.envios_pedido (
  id bigserial primary key,
  ip_hash text not null,
  criado_em timestamptz not null default now()
);

create index if not exists envios_pedido_ip_idx on public.envios_pedido (ip_hash, criado_em);

alter table public.envios_pedido enable row level security;
