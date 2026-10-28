-- Status "pronto" para o KDS da cozinha: preparo → pronto → entrega (ou concluído, no balcão e na mesa).
alter table public.pedidos drop constraint if exists pedidos_status_check;
alter table public.pedidos add constraint pedidos_status_check
  check (status = any (array['recebido'::text, 'preparo'::text, 'pronto'::text, 'entrega'::text, 'concluido'::text, 'cancelado'::text]));
