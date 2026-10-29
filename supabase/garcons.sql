-- Garçons de cada pizzaria: login e senha próprios, sem conta do Muvo. A senha fica só como hash.
create table if not exists public.garcons (
  id uuid primary key default gen_random_uuid(),
  pizzaria_slug text not null,
  nome text not null check (char_length(nome) between 1 and 60),
  login text not null check (login ~ '^[a-z0-9._-]{3,30}$'),
  password_hash text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (pizzaria_slug, login)
);

alter table public.garcons enable row level security;
