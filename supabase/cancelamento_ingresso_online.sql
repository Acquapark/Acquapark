-- Aqua Park Manager — cancelar ingresso comprado online sem mexer no caixa do balcão
-- Rode este script no SQL Editor do Supabase, DEPOIS de venda_online.sql.
--
-- O dinheiro da venda online cai na Asaas, não na gaveta do balcão, e os
-- lançamentos dela não têm caixa. Antes, cancelar um desses ingressos lançava
-- o estorno no caixa aberto de quem cancelou — e o fechamento dava diferença.
-- Agora, ingresso de pedido online:
--   - pode ser cancelado com o caixa fechado;
--   - o estorno é lançado SEM caixa (só para Recebimentos e relatórios);
--   - qualquer devolução de dinheiro, se houver, é feita direto na Asaas.
-- Ingresso vendido no balcão continua exigindo o caixa aberto, como antes.

create or replace function cancelar_ingresso(p_ingresso_id uuid)
returns ingressos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_caixa_id uuid;
  v_ingresso ingressos%rowtype;
  v_pagamento pagamentos%rowtype;
begin
  update ingressos set status = 'Cancelado'
   where id = p_ingresso_id and status = 'Disponível'
  returning * into v_ingresso;
  if not found then
    raise exception 'Só é possível cancelar ingressos disponíveis.';
  end if;

  if v_ingresso.pedido_online_id is null then
    select id into v_caixa_id from caixas where operador_id = auth.uid() and status = 'Aberto';
    if v_caixa_id is null then
      -- A exceção desfaz o "Cancelado" acima (mesma transação).
      raise exception 'Abra o caixa antes de cancelar ingressos (o estorno é lançado no caixa).';
    end if;
  end if;

  -- Estorna todos os lançamentos do ingresso (um por forma, se o pagamento foi dividido).
  for v_pagamento in
    select * from pagamentos where ingresso_id = p_ingresso_id and valor > 0 order by pago_em
  loop
    insert into pagamentos (ingresso_id, valor, forma_pagamento, referencia, usuario_id, caixa_id)
    values (p_ingresso_id, -v_pagamento.valor, v_pagamento.forma_pagamento, 'Estorno ' || v_ingresso.numero, auth.uid(), v_caixa_id);
  end loop;

  return v_ingresso;
end;
$$;
