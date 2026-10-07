-- Aqua Park Manager — venda de ingressos de tipos diferentes na mesma venda
-- Rode este script no SQL Editor do Supabase, DEPOIS de multi_ingresso_sem_expiracao.sql.
--
-- Na Bilheteria, Ctrl + clique seleciona mais de um tipo de ingresso (ex: 2
-- Adulto + 1 Infantil) num pagamento só. Esta função chama vender_ingresso
-- para cada tipo DENTRO DA MESMA TRANSAÇÃO: se qualquer parte falhar (caixa
-- fechado, tipo inativo, cupom sem usos suficientes), nada é emitido nem
-- cobrado. Comprador, data, forma de pagamento e cupom valem para a venda toda.
--
-- p_itens: [{ "tipo_id": "<uuid>", "quantidade": 2 }, ...]

create or replace function vender_ingressos_varios(
  p_itens jsonb,
  p_comprador text,
  p_data_utilizacao date,
  p_forma_pagamento text,
  p_cupom_codigo text default null
)
returns setof ingressos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
  v_total integer := 0;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Selecione ao menos um tipo de ingresso.';
  end if;

  select coalesce(sum((i->>'quantidade')::integer), 0) into v_total from jsonb_array_elements(p_itens) i;
  if v_total < 1 or v_total > 50 then
    raise exception 'A venda deve ter entre 1 e 50 ingressos no total.';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    return query
      select * from vender_ingresso(
        (v_item->>'tipo_id')::uuid,
        p_comprador,
        p_data_utilizacao,
        p_forma_pagamento,
        p_cupom_codigo,
        (v_item->>'quantidade')::integer
      );
  end loop;
end;
$$;
