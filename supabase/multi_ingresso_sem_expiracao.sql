-- Aqua Park Manager — venda de vários ingressos de uma vez + ingresso sem expiração
-- Rode este script no SQL Editor do Supabase (idempotente).

-- Tipo "sem expiração": o ingresso emitido nunca vence e a catraca sempre libera
-- (a validação ignora data e nunca marca como "Utilizado"). Copiado do tipo pra
-- cada ingresso na hora da venda, igual à regra de entrada.
alter table tipos_ingresso add column if not exists sem_expiracao boolean not null default false;
alter table ingressos add column if not exists sem_expiracao boolean not null default false;

-- vender_ingresso ganha p_quantidade e passa a devolver todos os ingressos
-- emitidos (setof) — tudo na mesma transação: se qualquer um falhar (cupom sem
-- usos suficientes, por exemplo), nenhum é emitido nem cobrado. Cada ingresso
-- tem seu próprio número, QR Code e registro de pagamento (assim cancelar ou
-- excluir um não mexe nos outros). O cupom vale pra cada ingresso e consome um
-- uso por ingresso. Como o tipo de retorno muda, a função antiga é removida antes.
drop function if exists vender_ingresso(uuid, text, date, text, text);

create or replace function vender_ingresso(
  p_tipo_id uuid,
  p_comprador text,
  p_data_utilizacao date,
  p_forma_pagamento text,
  p_cupom_codigo text default null,
  p_quantidade integer default 1
)
returns setof ingressos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tipo tipos_ingresso%rowtype;
  v_cupom cupons_desconto%rowtype;
  v_ingresso ingressos%rowtype;
  v_caixa_id uuid;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_data date;
  v_regra regra_reentrada;
  v_desconto numeric(10, 2) := 0;
  v_valor_final numeric(10, 2);
  v_i integer;
begin
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 50 then
    raise exception 'A quantidade de ingressos deve ser entre 1 e 50.';
  end if;

  select id into v_caixa_id from caixas where operador_id = auth.uid() and status = 'Aberto';
  if v_caixa_id is null then
    raise exception 'Abra o caixa antes de realizar vendas.';
  end if;

  select * into v_tipo from tipos_ingresso where id = p_tipo_id and ativo;
  if not found then
    raise exception 'Tipo de ingresso não encontrado ou inativo.';
  end if;

  if v_tipo.sem_expiracao then
    -- Sem expiração: a data é só a da emissão e a entrada é sempre livre.
    v_data := v_hoje;
    v_regra := 'ilimitado';
  else
    if p_data_utilizacao < v_hoje then
      raise exception 'A data de utilização não pode ser anterior a hoje.';
    end if;
    v_data := p_data_utilizacao;
    v_regra := v_tipo.regra_reentrada;
  end if;

  if nullif(trim(coalesce(p_cupom_codigo, '')), '') is not null then
    select * into v_cupom from cupons_desconto
      where upper(codigo) = upper(trim(p_cupom_codigo))
      for update;
    if not found then
      raise exception 'Cupom não encontrado.';
    end if;
    if not v_cupom.ativo then
      raise exception 'Este cupom não está mais ativo.';
    end if;
    if v_cupom.validade is not null and v_cupom.validade < v_hoje then
      raise exception 'Este cupom expirou.';
    end if;
    if v_cupom.limite_usos is not null and v_cupom.usos + p_quantidade > v_cupom.limite_usos then
      if v_cupom.usos >= v_cupom.limite_usos then
        raise exception 'Este cupom atingiu o limite de usos.';
      end if;
      raise exception 'Este cupom só tem % uso(s) restante(s), menos que a quantidade de ingressos da venda.',
        v_cupom.limite_usos - v_cupom.usos;
    end if;

    if v_cupom.tipo_desconto = 'percentual' then
      v_desconto := round(v_tipo.valor * v_cupom.valor / 100, 2);
    else
      v_desconto := least(v_cupom.valor, v_tipo.valor);
    end if;

    update cupons_desconto set usos = usos + p_quantidade where id = v_cupom.id;
  end if;

  v_valor_final := v_tipo.valor - v_desconto;

  for v_i in 1..p_quantidade loop
    insert into ingressos (tipo_id, comprador_nome, data_utilizacao, valor, valor_desconto, cupom_id, regra_reentrada, sem_expiracao, forma_pagamento, vendido_por)
    values (v_tipo.id, nullif(trim(p_comprador), ''), v_data, v_valor_final, v_desconto, v_cupom.id, v_regra, v_tipo.sem_expiracao, p_forma_pagamento, auth.uid())
    returning * into v_ingresso;

    insert into pagamentos (ingresso_id, valor, forma_pagamento, referencia, usuario_id, caixa_id)
    values (v_ingresso.id, v_ingresso.valor, p_forma_pagamento, v_ingresso.numero, auth.uid(), v_caixa_id);

    return next v_ingresso;
  end loop;

  return;
end;
$$;
