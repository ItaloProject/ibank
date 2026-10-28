-- Pedido lançado pelo painel (telefone, balcão, mesa). A coluna origem separa esses pedidos dos feitos no cardápio.
alter table public.pedidos add column if not exists origem text not null default 'cardapio'
  check (origem in ('cardapio', 'manual'));

-- Pedido lançado pelo painel não dispara o aviso de pedido novo: quem lançou já sabe do pedido.
-- O resto da função é o mesmo de antes.
create or replace function public.avisar_novo_pedido()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  destino text;
  segredo text;
begin
  if new.origem = 'manual' then
    return new;
  end if;

  select valor into destino from public.config_servidor where chave = 'url_notificacao';
  select valor into segredo from public.config_servidor where chave = 'segredo_notificacao';
  if destino is null or segredo is null then
    return new;
  end if;
  perform net.http_post(
    url := destino,
    body := jsonb_build_object(
      'slug', new.pizzaria_slug,
      'id', new.id,
      'numero', new.numero,
      'total', new.total,
      'pagamento', new.pagamento
    ),
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Segredo', segredo)
  );
  return new;
end;
$function$;
