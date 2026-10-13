-- Aqua Park Manager — venda de ingressos com o pagamento dividido em mais de uma forma
-- Rode este script no SQL Editor do Supabase, DEPOIS de venda_varios_tipos.sql.
--
-- Ex: venda de R$ 130,00 paga com R$ 100,00 em Pix + R$ 30,00 em Dinheiro.
-- Cada ingresso continua com os seus próprios lançamentos em `pagamentos`,
-- mas agora pode ter mais de um (um por forma): o valor de cada forma é
-- distribuído pelos ingressos da venda, em ordem. Assim o fechamento do caixa,
-- os recebimentos e os relatórios somam cada forma com o valor exato, e o
-- cancelamento de um ingresso estorna exatamente o que ele recebeu em cada forma.

-- ---------------------------------------------------------------------------
-- 1. Venda com pagamento dividido
--    p_itens:      [{ "tipo_id": "<uuid>", "quantidade": 2 }, ...]
--    p_pagamentos: [{ "forma": "Pix", "valor": 100.00 }, { "forma": "Dinheiro", "valor": 30.00 }]
--    Tudo na mesma transação: se a soma das formas não bater com o total da
--    venda (ou qualquer outra coisa falhar), nada é emitido nem cobrado.
-- ---------------------------------------------------------------------------
create or replace function vender_ingressos_pagamento_dividido(
  p_itens jsonb,
  p_comprador text,
  p_data_utilizacao date,
  p_pagamentos jsonb,
  p_cupom_codigo text default null
)
returns setof ingressos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_formas_validas text[] := array['Dinheiro', 'Pix', 'Cartão de débito', 'Cartão de crédito'];
  v_ids uuid[] := '{}';
  v_ingresso ingressos%rowtype;
  v_total_venda numeric(10, 2);
  v_total_formas numeric(10, 2);
  v_rotulo text;
  v_caixa_id uuid;
  v_formas text[];
  v_restantes numeric(10, 2)[];
  v_parte integer := 1;
  v_falta numeric(10, 2);
  v_valor numeric(10, 2);
  v_item jsonb;
begin
  if p_pagamentos is null or jsonb_typeof(p_pagamentos) <> 'array' or jsonb_array_length(p_pagamentos) < 2 then
    raise exception 'Informe ao menos duas formas de pagamento para dividir.';
  end if;

  for v_item in select * from jsonb_array_elements(p_pagamentos) loop
    if not ((v_item->>'forma') = any (v_formas_validas)) then
      raise exception 'Forma de pagamento inválida: %.', v_item->>'forma';
    end if;
    if (v_item->>'valor')::numeric <= 0 then
      raise exception 'Cada forma de pagamento precisa de um valor maior que zero.';
    end if;
    v_formas := v_formas || (v_item->>'forma');
    v_restantes := v_restantes || round((v_item->>'valor')::numeric, 2);
  end loop;

  if (select count(distinct f) from unnest(v_formas) f) <> array_length(v_formas, 1) then
    raise exception 'Cada forma de pagamento só pode aparecer uma vez.';
  end if;

  -- Emite como sempre (com a 1ª forma) e depois refaz os lançamentos divididos.
  for v_ingresso in
    select * from vender_ingressos_varios(p_itens, p_comprador, p_data_utilizacao, v_formas[1], p_cupom_codigo)
  loop
    v_ids := v_ids || v_ingresso.id;
  end loop;

  select coalesce(sum(valor), 0) into v_total_venda from ingressos where id = any (v_ids);
  select coalesce(sum(r), 0) into v_total_formas from unnest(v_restantes) r;
  if v_total_formas <> v_total_venda then
    raise exception 'A soma das formas de pagamento (R$ %) é diferente do total da venda (R$ %).',
      to_char(v_total_formas, 'FM999G990D00'), to_char(v_total_venda, 'FM999G990D00');
  end if;

  select caixa_id into v_caixa_id from pagamentos where ingresso_id = any (v_ids) limit 1;
  delete from pagamentos where ingresso_id = any (v_ids);

  v_rotulo := array_to_string(v_formas, ' + ');

  -- Distribui as formas pelos ingressos, em ordem: cada ingresso recebe da
  -- forma atual até completar o valor dele, passando para a próxima quando ela acaba.
  for v_ingresso in select * from ingressos where id = any (v_ids) order by numero loop
    v_falta := v_ingresso.valor;
    while v_falta > 0 loop
      while v_parte <= array_length(v_restantes, 1) and v_restantes[v_parte] <= 0 loop
        v_parte := v_parte + 1;
      end loop;
      v_valor := least(v_falta, v_restantes[v_parte]);
      insert into pagamentos (ingresso_id, valor, forma_pagamento, referencia, usuario_id, caixa_id)
      values (v_ingresso.id, v_valor, v_formas[v_parte], v_ingresso.numero, auth.uid(), v_caixa_id);
      v_restantes[v_parte] := v_restantes[v_parte] - v_valor;
      v_falta := v_falta - v_valor;
    end loop;
  end loop;

  update ingressos set forma_pagamento = v_rotulo where id = any (v_ids);
  return query select * from ingressos where id = any (v_ids) order by numero;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Cancelamento: estorna TODOS os lançamentos do ingresso (um por forma).
--    Antes só o primeiro era estornado — com pagamento dividido, a outra
--    parte ficaria no caixa.
-- ---------------------------------------------------------------------------
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
  select id into v_caixa_id from caixas where operador_id = auth.uid() and status = 'Aberto';
  if v_caixa_id is null then
    raise exception 'Abra o caixa antes de cancelar ingressos (o estorno é lançado no caixa).';
  end if;

  update ingressos set status = 'Cancelado'
   where id = p_ingresso_id and status = 'Disponível'
  returning * into v_ingresso;
  if not found then
    raise exception 'Só é possível cancelar ingressos disponíveis.';
  end if;

  for v_pagamento in
    select * from pagamentos where ingresso_id = p_ingresso_id and valor > 0 order by pago_em
  loop
    insert into pagamentos (ingresso_id, valor, forma_pagamento, referencia, usuario_id, caixa_id)
    values (p_ingresso_id, -v_pagamento.valor, v_pagamento.forma_pagamento, 'Estorno ' || v_ingresso.numero, auth.uid(), v_caixa_id);
  end loop;

  return v_ingresso;
end;
$$;
