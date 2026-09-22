-- Aqua Park Manager — cupons de desconto na venda de ingressos avulsos
-- Rode este script no SQL Editor do Supabase (idempotente).

create table if not exists cupons_desconto (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  descricao text,
  tipo_desconto text not null check (tipo_desconto in ('percentual', 'valor_fixo')),
  valor numeric(10, 2) not null,
  ativo boolean not null default true,
  validade date,
  limite_usos integer check (limite_usos is null or limite_usos > 0),
  usos integer not null default 0,
  created_at timestamptz not null default now(),
  constraint cupons_desconto_valor_check check (
    (tipo_desconto = 'percentual' and valor > 0 and valor <= 100)
    or (tipo_desconto = 'valor_fixo' and valor > 0)
  )
);

-- Busca por código é sempre case-insensitive (o código é salvo em maiúsculas).
create unique index if not exists idx_cupons_desconto_codigo on cupons_desconto (upper(codigo));

alter table cupons_desconto enable row level security;
drop policy if exists "staff_full_access" on cupons_desconto;
create policy "staff_full_access" on cupons_desconto
  for all to authenticated using (is_staff()) with check (is_staff());

-- Qual cupom foi usado em cada ingresso, e quanto ele descontou — o `valor` do
-- ingresso já é o valor final (com desconto aplicado), como antes.
alter table ingressos add column if not exists cupom_id uuid references cupons_desconto(id);
alter table ingressos add column if not exists valor_desconto numeric(10, 2) not null default 0;

-- Nome do comprador deixa de ser obrigatório: já era nullable no banco
-- (nullif(trim(...), '') em vender_ingresso já tratava string vazia como null);
-- a obrigatoriedade só existia na tela e na Server Action.

-- vender_ingresso ganha o parâmetro opcional do cupom. Valida e consome o
-- cupom dentro da mesma transação (lock de linha evita duas vendas
-- simultâneas estourarem o limite_usos).
create or replace function vender_ingresso(
  p_tipo_id uuid,
  p_comprador text,
  p_data_utilizacao date,
  p_forma_pagamento text,
  p_cupom_codigo text default null
)
returns ingressos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tipo tipos_ingresso%rowtype;
  v_cupom cupons_desconto%rowtype;
  v_ingresso ingressos%rowtype;
  v_caixa_id uuid;
  v_desconto numeric(10, 2) := 0;
  v_valor_final numeric(10, 2);
begin
  select id into v_caixa_id from caixas where operador_id = auth.uid() and status = 'Aberto';
  if v_caixa_id is null then
    raise exception 'Abra o caixa antes de realizar vendas.';
  end if;

  select * into v_tipo from tipos_ingresso where id = p_tipo_id and ativo;
  if not found then
    raise exception 'Tipo de ingresso não encontrado ou inativo.';
  end if;

  if p_data_utilizacao < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A data de utilização não pode ser anterior a hoje.';
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
    if v_cupom.validade is not null and v_cupom.validade < (now() at time zone 'America/Sao_Paulo')::date then
      raise exception 'Este cupom expirou.';
    end if;
    if v_cupom.limite_usos is not null and v_cupom.usos >= v_cupom.limite_usos then
      raise exception 'Este cupom atingiu o limite de usos.';
    end if;

    if v_cupom.tipo_desconto = 'percentual' then
      v_desconto := round(v_tipo.valor * v_cupom.valor / 100, 2);
    else
      v_desconto := least(v_cupom.valor, v_tipo.valor);
    end if;

    update cupons_desconto set usos = usos + 1 where id = v_cupom.id;
  end if;

  v_valor_final := v_tipo.valor - v_desconto;

  insert into ingressos (tipo_id, comprador_nome, data_utilizacao, valor, valor_desconto, cupom_id, regra_reentrada, forma_pagamento, vendido_por)
  values (v_tipo.id, nullif(trim(p_comprador), ''), p_data_utilizacao, v_valor_final, v_desconto, v_cupom.id, v_tipo.regra_reentrada, p_forma_pagamento, auth.uid())
  returning * into v_ingresso;

  insert into pagamentos (ingresso_id, valor, forma_pagamento, referencia, usuario_id, caixa_id)
  values (v_ingresso.id, v_ingresso.valor, p_forma_pagamento, v_ingresso.numero, auth.uid(), v_caixa_id);

  return v_ingresso;
end;
$$;
