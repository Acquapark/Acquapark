-- Aqua Park Manager — nome do operador informado na abertura do caixa
-- Rode este script DEPOIS de caixa_module.sql.
--
-- `operador_id` continua sendo o login que abriu o caixa (usado nas regras de
-- venda/sangria). `operador_nome` é quem está de fato operando o caixa naquele
-- turno — útil quando o login é compartilhado.

alter table caixas add column if not exists operador_nome text;

-- Caixas já existentes: usa o nome do usuário que abriu.
update caixas c
   set operador_nome = u.nome
  from usuarios u
 where u.id = c.operador_id and c.operador_nome is null;

drop function if exists abrir_caixa(numeric);

create or replace function abrir_caixa(p_valor_abertura numeric, p_operador_nome text)
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
  if trim(coalesce(p_operador_nome, '')) = '' then
    raise exception 'Informe o nome do operador.';
  end if;

  begin
    insert into caixas (operador_id, operador_nome, valor_abertura)
    values (auth.uid(), trim(p_operador_nome), p_valor_abertura)
    returning * into v_caixa;
  exception when unique_violation then
    raise exception 'Você já possui um caixa aberto.';
  end;

  return v_caixa;
end;
$$;
