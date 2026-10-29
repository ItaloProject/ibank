-- Papel garcom na lista de acessos: liberado por pizzaria, pela própria tela da equipe.
alter table public.acessos drop constraint if exists acessos_papel_check;
alter table public.acessos add constraint acessos_papel_check check (papel = any (array['admin'::text, 'dono'::text, 'garcom'::text]));

alter table public.acessos drop constraint if exists acessos_check;
alter table public.acessos add constraint acessos_check check (
  (papel = 'admin' and pizzaria_slug is null) or (papel in ('dono', 'garcom') and pizzaria_slug is not null)
);
