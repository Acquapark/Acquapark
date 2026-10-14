-- Aqua Park Manager — remarcar a data de utilização de ingressos
-- Rode este script no SQL Editor do Supabase, DEPOIS de datas_funcionamento.sql.
--
-- Para imprevistos (o parque não abriu na data): a equipe muda a data de um
-- ingresso, de um pedido online inteiro ou de todos os ingressos de um dia.
-- O QR Code continua o mesmo. Cada mudança fica registrada (data anterior,
-- data nova, quem alterou e quando). A permissão "Alterar data de utilização"
-- é conferida no servidor antes de chamar a função.

create table if not exists ingressos_remarcacoes (
  id uuid primary key default gen_random_uuid(),
  ingresso_id uuid not null references ingressos(id) on delete cascade,
  data_anterior date not null,
  data_nova date not null,
  motivo text,
  alterado_por uuid references usuarios(id),
  alterado_em timestamptz not null default now()
);

create index if not exists idx_ingressos_remarcacoes_ingresso on ingressos_remarcacoes(ingresso_id, alterado_em desc);

alter table ingressos_remarcacoes enable row level security;

create policy "staff_full_access" on ingressos_remarcacoes
  for all to authenticated
  using (is_staff()) with check (is_staff());

-- A remarcação atualiza a data do pedido online junto (a equipe só lia os pedidos).
create policy "staff_update_pedidos_online" on pedidos_online
  for update to authenticated
  using (is_staff()) with check (is_staff());

-- Remarca os ingressos (todos ou nenhum). Regras:
--   - só ingressos "Disponível" e com data (os "sem expiração" não têm data);
--   - a data nova é hoje ou depois;
--   - ingresso de pedido online só vai para um dia em que o parque abre
--     (a remarcação feita pela equipe não esbarra no limite diário).
-- Devolve os pedidos online afetados, para o servidor avisar os compradores por e-mail.
create or replace function remarcar_ingressos(p_ingresso_ids uuid[], p_nova_data date, p_motivo text default null)
returns table (pedido_online_id uuid, data_anterior date, quantidade integer)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ingresso ingressos%rowtype;
  v_total integer := 0;
begin
  if p_nova_data is null or p_nova_data < v_hoje then
    raise exception 'A nova data precisa ser hoje ou depois.';
  end if;
  if p_ingresso_ids is null or array_length(p_ingresso_ids, 1) is null then
    raise exception 'Nenhum ingresso para remarcar.';
  end if;

  create temporary table if not exists _remarcados (pedido_online_id uuid, data_anterior date) on commit drop;
  delete from _remarcados;

  for v_ingresso in
    select * from ingressos where id = any (p_ingresso_ids) order by numero for update
  loop
    if v_ingresso.status <> 'Disponível' then
      raise exception 'O ingresso % não está disponível (%): só ingressos não usados podem ser remarcados.', v_ingresso.numero, v_ingresso.status;
    end if;
    if v_ingresso.sem_expiracao then
      raise exception 'O ingresso % não tem data (sem expiração).', v_ingresso.numero;
    end if;
    if v_ingresso.data_utilizacao = p_nova_data then
      continue;
    end if;
    if v_ingresso.pedido_online_id is not null
       and not exists (select 1 from datas_funcionamento where data = p_nova_data) then
      raise exception 'O ingresso % é da venda online e % não está marcado como dia de funcionamento. Abra o dia em Configurações → Venda Online ou escolha outra data.',
        v_ingresso.numero, to_char(p_nova_data, 'DD/MM/YYYY');
    end if;

    insert into ingressos_remarcacoes (ingresso_id, data_anterior, data_nova, motivo, alterado_por)
    values (v_ingresso.id, v_ingresso.data_utilizacao, p_nova_data, nullif(trim(coalesce(p_motivo, '')), ''), auth.uid());

    update ingressos set data_utilizacao = p_nova_data where id = v_ingresso.id;

    if v_ingresso.pedido_online_id is not null then
      insert into _remarcados values (v_ingresso.pedido_online_id, v_ingresso.data_utilizacao);
    end if;
    v_total := v_total + 1;
  end loop;

  if v_total = 0 then
    raise exception 'Nenhum ingresso foi remarcado (já estavam nessa data?).';
  end if;

  -- O pedido online acompanha a nova data (aparece certo na aba "Vendas online" e no e-mail).
  update pedidos_online po set data_utilizacao = p_nova_data
   where po.id in (select r.pedido_online_id from _remarcados r);

  return query
    select r.pedido_online_id, min(r.data_anterior), count(*)::integer
      from _remarcados r
     group by r.pedido_online_id;
end;
$$;
