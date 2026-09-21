-- Aqua Park Manager — módulo Bilheteria
-- Rode este script DEPOIS de schema.sql, policies.sql, seed.sql e portal_module.sql.

-- Número sequencial legível do ingresso (ING-000001...). O QR Code usa `codigo`
-- (opaco), nunca o número.
create sequence if not exists ingressos_numero_seq start 1;

alter table ingressos
  alter column numero set default ('ING-' || lpad(nextval('ingressos_numero_seq')::text, 6, '0')),
  add column if not exists forma_pagamento text,
  add column if not exists vendido_por uuid references usuarios(id),
  add column if not exists utilizado_em timestamptz;

-- Regra de reentrada definida no tipo e copiada para cada ingresso vendido.
alter table tipos_ingresso
  add column if not exists regra_reentrada regra_reentrada not null default 'unica';

-- Emite o ingresso e registra o pagamento na mesma transação (security invoker:
-- respeita o RLS de quem chama, ou seja, só a equipe consegue vender).
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
begin
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

  insert into pagamentos (ingresso_id, valor, forma_pagamento, referencia, usuario_id)
  values (v_ingresso.id, v_ingresso.valor, p_forma_pagamento, v_ingresso.numero, auth.uid());

  return v_ingresso;
end;
$$;
