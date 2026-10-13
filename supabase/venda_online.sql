-- Aqua Park Manager — venda de ingressos online (página pública /comprar)
-- Rode este script no SQL Editor do Supabase, DEPOIS de venda_pagamento_dividido.sql.
--
-- 1. Tipos de ingresso ganham "disponível para venda online".
-- 2. Configuração da venda online (em `empresa`): ligada/desligada, limite de
--    ingressos online por dia, horário limite para comprar para o próprio dia
--    e até quantos dias à frente.
-- 3. Pedidos online: criados como "Aguardando pagamento" (reservam as vagas do
--    dia por 30 minutos); os ingressos só são emitidos quando a Asaas confirma
--    o pagamento. Pix pago depois do prazo também é emitido (o dinheiro entrou).
-- 4. Funções:
--    - criar_pedido_online: valida tudo e calcula os preços NO BANCO (nada vem
--      do navegador além de quantidades), com trava por data para o limite
--      diário não estourar com compras simultâneas;
--    - emitir_ingressos_pedido_online: idempotente (o webhook pode chegar duas
--      vezes) — emite os ingressos e os lançamentos em `pagamentos`.
-- Tudo é chamado pelo servidor com a service role; o público não acessa as tabelas.

-- ---------------------------------------------------------------------------
-- Configuração
-- ---------------------------------------------------------------------------
alter table tipos_ingresso
  add column if not exists disponivel_online boolean not null default false;

alter table empresa
  add column if not exists venda_online_ativa boolean not null default false,
  -- null = sem limite
  add column if not exists venda_online_limite_diario integer,
  add column if not exists venda_online_hora_limite time not null default '14:00',
  add column if not exists venda_online_dias_antecedencia integer not null default 60;

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
create sequence if not exists pedidos_online_numero_seq;

create table if not exists pedidos_online (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default ('WEB-' || lpad(nextval('pedidos_online_numero_seq')::text, 6, '0')),
  -- Link público do pedido (/comprar/pedido/<token>): difícil de adivinhar.
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  comprador_nome text not null,
  comprador_cpf text not null,
  comprador_email text not null,
  comprador_telefone text not null,
  data_utilizacao date not null,
  -- [{ "tipo_id", "nome", "quantidade", "valor_unitario", "valor_desconto" }]
  itens jsonb not null,
  quantidade integer not null,
  cupom_id uuid references cupons_desconto(id),
  valor_total numeric(10, 2) not null,
  forma_pagamento text not null check (forma_pagamento in ('Pix', 'Cartão de crédito')),
  status text not null default 'Aguardando pagamento'
    check (status in ('Aguardando pagamento', 'Pago', 'Cancelado')),
  gateway_charge_id text unique,
  pix_copia_e_cola text,
  checkout_url text,
  expira_em timestamptz not null,
  pago_em timestamptz,
  email_enviado_em timestamptz,
  ip text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_pedidos_online_data on pedidos_online(data_utilizacao, status);
create index if not exists idx_pedidos_online_criado on pedidos_online(criado_em desc);

alter table ingressos
  add column if not exists pedido_online_id uuid references pedidos_online(id) on delete set null;

create index if not exists idx_ingressos_pedido_online on ingressos(pedido_online_id) where pedido_online_id is not null;

alter table pedidos_online enable row level security;

-- Equipe lê os pedidos (aba "Vendas online" da Bilheteria). Escrita só pelo servidor.
create policy "staff_read_pedidos_online" on pedidos_online
  for select to authenticated
  using (is_staff());

-- ---------------------------------------------------------------------------
-- Criar pedido
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Emitir os ingressos de um pedido pago (idempotente)
-- ---------------------------------------------------------------------------
create or replace function emitir_ingressos_pedido_online(p_pedido_id uuid, p_forma text default null)
returns setof ingressos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pedido pedidos_online%rowtype;
  v_item jsonb;
  v_tipo tipos_ingresso%rowtype;
  v_ingresso ingressos%rowtype;
  v_forma text;
  v_i integer;
begin
  select * into v_pedido from pedidos_online where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  -- Já emitido (webhook repetido): devolve os mesmos ingressos.
  if v_pedido.status = 'Pago' then
    return query select * from ingressos where pedido_online_id = p_pedido_id order by numero;
    return;
  end if;

  v_forma := coalesce(nullif(p_forma, ''), v_pedido.forma_pagamento);

  for v_item in select * from jsonb_array_elements(v_pedido.itens) loop
    select * into v_tipo from tipos_ingresso where id = (v_item->>'tipo_id')::uuid;
    for v_i in 1..(v_item->>'quantidade')::integer loop
      insert into ingressos (
        tipo_id, comprador_nome, data_utilizacao, valor, valor_desconto, cupom_id,
        regra_reentrada, sem_expiracao, forma_pagamento, vendido_por, pedido_online_id
      ) values (
        v_tipo.id, v_pedido.comprador_nome,
        case when v_tipo.sem_expiracao then (now() at time zone 'America/Sao_Paulo')::date else v_pedido.data_utilizacao end,
        (v_item->>'valor_unitario')::numeric, (v_item->>'valor_desconto')::numeric, v_pedido.cupom_id,
        case when v_tipo.sem_expiracao then 'ilimitado'::regra_reentrada else v_tipo.regra_reentrada end,
        v_tipo.sem_expiracao, v_forma, null, v_pedido.id
      )
      returning * into v_ingresso;

      -- Fora do caixa do balcão (caixa_id nulo): entra em Recebimentos e relatórios.
      insert into pagamentos (ingresso_id, valor, forma_pagamento, referencia, usuario_id, caixa_id)
      values (v_ingresso.id, v_ingresso.valor, v_forma, v_ingresso.numero, null, null);

      return next v_ingresso;
    end loop;
  end loop;

  if v_pedido.cupom_id is not null then
    update cupons_desconto set usos = usos + v_pedido.quantidade where id = v_pedido.cupom_id;
  end if;

  update pedidos_online
     set status = 'Pago', pago_em = now(), forma_pagamento = case when v_forma in ('Pix', 'Cartão de crédito') then v_forma else forma_pagamento end
   where id = p_pedido_id;

  return;
end;
$$;
