-- Aqua Park Manager — módulo Caixa (abertura/fechamento, sangria, suprimento)
-- Rode este script DEPOIS de bilheteria_module.sql.
--
-- Regras:
--  * Cada operador só pode ter UM caixa aberto por vez.
--  * Venda de ingresso só é possível com o caixa do operador aberto (a trava
--    fica no banco, na função vender_ingresso — não dá para burlar pela tela).
--  * O dinheiro esperado no fechamento =
--      valor de abertura + suprimentos - sangrias + vendas em dinheiro - estornos em dinheiro.
--  * Cancelar um ingresso lança um estorno (pagamento negativo) no caixa aberto.

create sequence if not exists caixas_numero_seq start 1;

create table if not exists caixas (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default ('CX-' || lpad(nextval('caixas_numero_seq')::text, 6, '0')),
  operador_id uuid not null references usuarios(id),
  status text not null default 'Aberto' check (status in ('Aberto', 'Fechado')),
  valor_abertura numeric(10, 2) not null default 0 check (valor_abertura >= 0),
  aberto_em timestamptz not null default now(),
  fechado_em timestamptz,
  valor_esperado numeric(10, 2),
  valor_contado numeric(10, 2),
  diferenca numeric(10, 2),
  observacoes text,
  reaberto_em timestamptz,
  reaberto_por uuid references usuarios(id),
  reaberturas integer not null default 0
);

create unique index if not exists idx_caixas_um_aberto_por_operador
  on caixas (operador_id) where status = 'Aberto';
create index if not exists idx_caixas_aberto_em on caixas (aberto_em desc);

create table if not exists caixa_movimentos (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references caixas(id) on delete cascade,
  tipo text not null check (tipo in ('Suprimento', 'Sangria')),
  valor numeric(10, 2) not null check (valor > 0),
  motivo text,
  usuario_id uuid references usuarios(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_caixa_movimentos_caixa on caixa_movimentos (caixa_id);

alter table pagamentos add column if not exists caixa_id uuid references caixas(id);
create index if not exists idx_pagamentos_caixa on pagamentos (caixa_id);

alter table caixas enable row level security;
alter table caixa_movimentos enable row level security;

drop policy if exists "staff_full_access" on caixas;
create policy "staff_full_access" on caixas
  for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "staff_full_access" on caixa_movimentos;
create policy "staff_full_access" on caixa_movimentos
  for all to authenticated using (is_staff()) with check (is_staff());

-- Dinheiro que deveria estar na gaveta agora.
create or replace function caixa_saldo_dinheiro(p_caixa_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.valor_abertura
    + coalesce((select sum(case when m.tipo = 'Suprimento' then m.valor else -m.valor end)
                from caixa_movimentos m where m.caixa_id = c.id), 0)
    + coalesce((select sum(p.valor) from pagamentos p
                where p.caixa_id = c.id and p.forma_pagamento = 'Dinheiro'), 0)
  from caixas c
  where c.id = p_caixa_id;
$$;

create or replace function abrir_caixa(p_valor_abertura numeric)
returns caixas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_caixa caixas%rowtype;
begin
  if p_valor_abertura is null or p_valor_abertura < 0 then
    raise exception 'Informe um valor de abertura válido.';
  end if;

  begin
    insert into caixas (operador_id, valor_abertura)
    values (auth.uid(), p_valor_abertura)
    returning * into v_caixa;
  exception when unique_violation then
    raise exception 'Você já possui um caixa aberto.';
  end;

  return v_caixa;
end;
$$;

create or replace function registrar_movimento_caixa(
  p_caixa_id uuid,
  p_tipo text,
  p_valor numeric,
  p_motivo text
)
returns caixa_movimentos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_caixa caixas%rowtype;
  v_mov caixa_movimentos%rowtype;
begin
  if p_tipo not in ('Suprimento', 'Sangria') then
    raise exception 'Tipo de movimentação inválido.';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor maior que zero.';
  end if;

  select * into v_caixa from caixas where id = p_caixa_id for update;
  if not found then
    raise exception 'Caixa não encontrado.';
  end if;
  if v_caixa.status <> 'Aberto' then
    raise exception 'O caixa está fechado.';
  end if;
  if v_caixa.operador_id <> auth.uid() then
    raise exception 'Somente o operador do caixa pode registrar movimentações.';
  end if;

  if p_tipo = 'Sangria' then
    if trim(coalesce(p_motivo, '')) = '' then
      raise exception 'Informe o motivo da sangria.';
    end if;
    if p_valor > caixa_saldo_dinheiro(p_caixa_id) then
      raise exception 'O valor da sangria é maior que o dinheiro disponível no caixa.';
    end if;
  end if;

  insert into caixa_movimentos (caixa_id, tipo, valor, motivo, usuario_id)
  values (p_caixa_id, p_tipo, p_valor, nullif(trim(coalesce(p_motivo, '')), ''), auth.uid())
  returning * into v_mov;

  return v_mov;
end;
$$;

create or replace function fechar_caixa(
  p_caixa_id uuid,
  p_valor_contado numeric,
  p_observacoes text
)
returns caixas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_caixa caixas%rowtype;
  v_esperado numeric;
  v_diferenca numeric;
begin
  if p_valor_contado is null or p_valor_contado < 0 then
    raise exception 'Informe o valor contado no caixa.';
  end if;

  select * into v_caixa from caixas where id = p_caixa_id for update;
  if not found then
    raise exception 'Caixa não encontrado.';
  end if;
  if v_caixa.status <> 'Aberto' then
    raise exception 'O caixa já está fechado.';
  end if;

  v_esperado := caixa_saldo_dinheiro(p_caixa_id);
  v_diferenca := p_valor_contado - v_esperado;

  if v_diferenca <> 0 and trim(coalesce(p_observacoes, '')) = '' then
    raise exception 'Há diferença no fechamento. Informe uma observação explicando.';
  end if;

  update caixas
     set status = 'Fechado',
         fechado_em = now(),
         valor_esperado = v_esperado,
         valor_contado = p_valor_contado,
         diferenca = v_diferenca,
         observacoes = nullif(trim(coalesce(p_observacoes, '')), '')
   where id = p_caixa_id
  returning * into v_caixa;

  return v_caixa;
end;
$$;

create or replace function reabrir_caixa(p_caixa_id uuid)
returns caixas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_caixa caixas%rowtype;
begin
  select * into v_caixa from caixas where id = p_caixa_id for update;
  if not found then
    raise exception 'Caixa não encontrado.';
  end if;
  if v_caixa.status <> 'Fechado' then
    raise exception 'O caixa já está aberto.';
  end if;

  begin
    update caixas
       set status = 'Aberto',
           fechado_em = null,
           valor_esperado = null,
           valor_contado = null,
           diferenca = null,
           observacoes = null,
           reaberto_em = now(),
           reaberto_por = auth.uid(),
           reaberturas = reaberturas + 1
     where id = p_caixa_id
    returning * into v_caixa;
  exception when unique_violation then
    raise exception 'O operador deste caixa já possui outro caixa aberto. Feche-o antes de reabrir este.';
  end;

  return v_caixa;
end;
$$;

-- Venda passa a exigir caixa aberto e vincula o pagamento ao caixa.
create or replace function vender_ingresso(
  p_tipo_id uuid,
  p_comprador text,
  p_data_utilizacao date,
  p_forma_pagamento text
)
returns ingressos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tipo tipos_ingresso%rowtype;
  v_ingresso ingressos%rowtype;
  v_caixa_id uuid;
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

  insert into ingressos (tipo_id, comprador_nome, data_utilizacao, valor, regra_reentrada, forma_pagamento, vendido_por)
  values (v_tipo.id, nullif(trim(p_comprador), ''), p_data_utilizacao, v_tipo.valor, v_tipo.regra_reentrada, p_forma_pagamento, auth.uid())
  returning * into v_ingresso;

  insert into pagamentos (ingresso_id, valor, forma_pagamento, referencia, usuario_id, caixa_id)
  values (v_ingresso.id, v_ingresso.valor, p_forma_pagamento, v_ingresso.numero, auth.uid(), v_caixa_id);

  return v_ingresso;
end;
$$;

-- Cancelamento exige caixa aberto: o estorno sai do caixa de quem cancela.
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

  select * into v_pagamento from pagamentos
   where ingresso_id = p_ingresso_id and valor > 0
   order by pago_em limit 1;

  if found then
    insert into pagamentos (ingresso_id, valor, forma_pagamento, referencia, usuario_id, caixa_id)
    values (p_ingresso_id, -v_pagamento.valor, v_pagamento.forma_pagamento, 'Estorno ' || v_ingresso.numero, auth.uid(), v_caixa_id);
  end if;

  return v_ingresso;
end;
$$;
