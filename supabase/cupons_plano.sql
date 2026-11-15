-- Aqua Park Manager — cupons de desconto também no plano do associado
-- Rode este script no SQL Editor do Supabase (idempotente: pode rodar de novo).
--
-- 1. Cada cupom diz para que serve: ingressos, planos de associado ou ambos.
--    Os cupons que já existem continuam valendo só para ingressos.
-- 2. Em plano, o cupom define em quantas mensalidades o desconto vale:
--    todas (meses_desconto nulo) ou só as N primeiras.
-- 3. O contrato guarda qual cupom foi usado (histórico e relatório).
-- 4. usar_cupom_plano(): confere e consome 1 uso do cupom de forma atômica
--    (trava a linha, então dois cadastros ao mesmo tempo não estouram o limite).
-- 5. O banco recusa cupom "só planos" em venda de ingresso (balcão e online).

alter table cupons_desconto add column if not exists aplica_a text not null default 'ingressos';
alter table cupons_desconto add column if not exists meses_desconto integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cupons_desconto_aplica_a_check') then
    alter table cupons_desconto
      add constraint cupons_desconto_aplica_a_check check (aplica_a in ('ingressos', 'planos', 'ambos'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cupons_desconto_meses_desconto_check') then
    alter table cupons_desconto
      add constraint cupons_desconto_meses_desconto_check check (meses_desconto is null or meses_desconto > 0);
  end if;
end $$;

alter table contratos add column if not exists cupom_id uuid references cupons_desconto(id);

-- ---------------------------------------------------------------------------
-- Consome 1 uso de um cupom de plano. Erro (exception) se não puder ser usado.
-- security invoker: a equipe (RLS is_staff) e o servidor (service role) chamam.
-- ---------------------------------------------------------------------------
create or replace function usar_cupom_plano(p_codigo text)
returns cupons_desconto
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cupom cupons_desconto%rowtype;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into v_cupom from cupons_desconto
  where upper(codigo) = upper(trim(p_codigo))
  for update;

  if not found or not v_cupom.ativo then
    raise exception 'Cupom inválido.';
  end if;
  if v_cupom.aplica_a not in ('planos', 'ambos') then
    raise exception 'Este cupom não vale para planos de associado.';
  end if;
  if v_cupom.validade is not null and v_cupom.validade < v_hoje then
    raise exception 'Este cupom expirou.';
  end if;
  if v_cupom.limite_usos is not null and v_cupom.usos >= v_cupom.limite_usos then
    raise exception 'Este cupom atingiu o limite de usos.';
  end if;

  update cupons_desconto set usos = usos + 1 where id = v_cupom.id returning * into v_cupom;
  return v_cupom;
end;
$$;

-- Devolve o uso quando o cadastro falha depois de consumir o cupom.
create or replace function devolver_cupom_plano(p_cupom_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update cupons_desconto set usos = greatest(usos - 1, 0) where id = p_cupom_id;
$$;

-- ---------------------------------------------------------------------------
-- Cupom "só planos" não entra em venda de ingresso.
-- Ingresso emitido de um pedido online já pago (pedido_online_id) passa: o
-- cupom foi conferido quando o pedido foi criado, e barrar aqui faria um
-- pagamento já recebido não gerar os ingressos.
-- ---------------------------------------------------------------------------
create or replace function bloquear_cupom_so_planos_pedido()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cupom_id is not null
     and exists (select 1 from cupons_desconto where id = new.cupom_id and aplica_a = 'planos') then
    raise exception 'Este cupom vale só para planos de associado, não para ingressos.';
  end if;
  return new;
end;
$$;

create or replace function bloquear_cupom_so_planos_ingresso()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cupom_id is not null
     and new.pedido_online_id is null
     and exists (select 1 from cupons_desconto where id = new.cupom_id and aplica_a = 'planos') then
    raise exception 'Este cupom vale só para planos de associado, não para ingressos.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ingressos_cupom_so_planos on ingressos;
create trigger trg_ingressos_cupom_so_planos
  before insert on ingressos
  for each row execute function bloquear_cupom_so_planos_ingresso();

drop trigger if exists trg_pedidos_online_cupom_so_planos on pedidos_online;
create trigger trg_pedidos_online_cupom_so_planos
  before insert on pedidos_online
  for each row execute function bloquear_cupom_so_planos_pedido();

-- ---------------------------------------------------------------------------
-- Verificação (rode depois): deve listar os cupons com aplica_a = 'ingressos'
-- e a função usar_cupom_plano.
-- ---------------------------------------------------------------------------
-- select codigo, aplica_a, meses_desconto from cupons_desconto order by codigo;
-- select proname from pg_proc where proname in ('usar_cupom_plano', 'devolver_cupom_plano', 'bloquear_cupom_so_planos_pedido', 'bloquear_cupom_so_planos_ingresso');
