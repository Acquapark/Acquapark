-- Aqua Park Manager — dias de funcionamento do parque (venda online)
-- Rode este script no SQL Editor do Supabase, DEPOIS de venda_online.sql.
--
-- A venda online só aceita datas marcadas como "parque aberto" em
-- Configurações → Venda Online (a equipe escolhe cada data no calendário).
-- A bilheteria do balcão não é afetada.
--
-- ATENÇÃO: sem nenhuma data marcada, a venda online fica sem datas
-- disponíveis. Marque os dias de funcionamento logo depois de rodar o script.

create table if not exists datas_funcionamento (
  data date primary key,
  criado_em timestamptz not null default now(),
  criado_por uuid references usuarios(id)
);

alter table datas_funcionamento enable row level security;

create policy "staff_full_access" on datas_funcionamento
  for all to authenticated
  using (is_staff()) with check (is_staff());

-- criar_pedido_online passa a recusar datas em que o parque não abre.
create or replace function criar_pedido_online(
  p_data date,
  p_itens jsonb, -- [{ "tipo_id": "<uuid>", "quantidade": 2 }]
  p_cupom_codigo text,
  p_nome text,
  p_cpf text,
  p_email text,
  p_telefone text,
  p_forma text,
  p_ip text,
  p_minutos_expiracao integer default 30
)
returns pedidos_online
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_empresa empresa%rowtype;
  v_agora_br timestamp := now() at time zone 'America/Sao_Paulo';
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_item jsonb;
  v_tipo tipos_ingresso%rowtype;
  v_cupom cupons_desconto%rowtype;
  v_qtd integer;
  v_quantidade integer := 0;
  v_desconto numeric(10, 2);
  v_unitario numeric(10, 2);
  v_total numeric(10, 2) := 0;
  v_itens jsonb := '[]'::jsonb;
  v_vendidos integer;
  v_pedido pedidos_online%rowtype;
begin
  select * into v_empresa from empresa where id;
  if not coalesce(v_empresa.venda_online_ativa, false) then
    raise exception 'A venda online está desativada no momento.';
  end if;

  if p_data is null or p_data < v_hoje then
    raise exception 'Escolha uma data a partir de hoje.';
  end if;
  if p_data > v_hoje + v_empresa.venda_online_dias_antecedencia then
    raise exception 'A venda online vai até % dias à frente.', v_empresa.venda_online_dias_antecedencia;
  end if;
  if not exists (select 1 from datas_funcionamento where data = p_data) then
    raise exception 'O parque não abre nesta data. Escolha um dos dias disponíveis no calendário.';
  end if;
  if p_data = v_hoje and v_agora_br::time >= v_empresa.venda_online_hora_limite then
    raise exception 'A venda online para hoje já encerrou (até %). Escolha outra data.', to_char(v_empresa.venda_online_hora_limite, 'HH24:MI');
  end if;

  if p_forma not in ('Pix', 'Cartão de crédito') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Escolha ao menos um ingresso.';
  end if;

  if nullif(trim(coalesce(p_cupom_codigo, '')), '') is not null then
    select * into v_cupom from cupons_desconto where upper(codigo) = upper(trim(p_cupom_codigo));
    if not found or not v_cupom.ativo then
      raise exception 'Cupom inválido.';
    end if;
    if v_cupom.validade is not null and v_cupom.validade < v_hoje then
      raise exception 'Este cupom expirou.';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := coalesce((v_item->>'quantidade')::integer, 0);
    if v_qtd <= 0 then
      continue;
    end if;
    select * into v_tipo from tipos_ingresso where id = (v_item->>'tipo_id')::uuid and ativo and disponivel_online;
    if not found then
      raise exception 'Um dos ingressos escolhidos não está mais disponível. Recarregue a página.';
    end if;

    v_desconto := 0;
    if v_cupom.id is not null then
      if v_cupom.tipo_desconto = 'percentual' then
        v_desconto := round(v_tipo.valor * v_cupom.valor / 100, 2);
      else
        v_desconto := least(v_cupom.valor, v_tipo.valor);
      end if;
    end if;
    v_unitario := v_tipo.valor - v_desconto;

    v_quantidade := v_quantidade + v_qtd;
    v_total := v_total + v_unitario * v_qtd;
    v_itens := v_itens || jsonb_build_object(
      'tipo_id', v_tipo.id, 'nome', v_tipo.nome, 'quantidade', v_qtd,
      'valor_unitario', v_unitario, 'valor_desconto', v_desconto
    );
  end loop;

  if v_quantidade < 1 or v_quantidade > 50 then
    raise exception 'Escolha entre 1 e 50 ingressos por compra.';
  end if;
  if v_cupom.id is not null and v_cupom.limite_usos is not null and v_cupom.usos + v_quantidade > v_cupom.limite_usos then
    raise exception 'Este cupom não tem usos suficientes para esta quantidade de ingressos.';
  end if;

  -- Trava por data: duas compras ao mesmo tempo não estouram o limite do dia.
  perform pg_advisory_xact_lock(hashtext('venda_online_' || p_data::text));

  if v_empresa.venda_online_limite_diario is not null then
    select coalesce(sum(quantidade), 0) into v_vendidos
      from pedidos_online
     where data_utilizacao = p_data
       and (status = 'Pago' or (status = 'Aguardando pagamento' and expira_em > now()));
    if v_vendidos + v_quantidade > v_empresa.venda_online_limite_diario then
      if v_vendidos >= v_empresa.venda_online_limite_diario then
        raise exception 'Os ingressos online para esta data estão esgotados.';
      end if;
      raise exception 'Restam só % ingresso(s) online para esta data.', v_empresa.venda_online_limite_diario - v_vendidos;
    end if;
  end if;

  insert into pedidos_online (
    comprador_nome, comprador_cpf, comprador_email, comprador_telefone, data_utilizacao,
    itens, quantidade, cupom_id, valor_total, forma_pagamento, expira_em, ip
  ) values (
    trim(p_nome), p_cpf, lower(trim(p_email)), p_telefone, p_data,
    v_itens, v_quantidade, v_cupom.id, v_total, p_forma, now() + make_interval(mins => p_minutos_expiracao), p_ip
  )
  returning * into v_pedido;

  return v_pedido;
end;
$$;
