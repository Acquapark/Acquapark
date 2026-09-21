-- Aqua Park Manager — módulo Portal do Associado
-- Rode este script DEPOIS de schema.sql, policies.sql, seed.sql e contratos_module.sql.
--
-- Este script faz duas coisas grandes:
-- 1) Estende planos/contratos/mensalidades com as regras financeiras do PRD
--    (quantidade de mensalidades, dia de vencimento, snapshot no contrato) e
--    cria a tabela de acesso do associado ao portal.
-- 2) REESCREVE as políticas de RLS. Até aqui, "staff_full_access" liberava
--    qualquer usuário AUTENTICADO (using (true)) — funcionava porque só a
--    equipe fazia login. Agora que associados também terão login via
--    Supabase Auth, isso precisa ser restrito a quem está na tabela
--    `usuarios` (staff). Associados recebem políticas próprias, somente
--    leitura e somente dos seus próprios dados.

-- =========================================================
-- PLANOS — regras financeiras do plano
-- =========================================================
alter table planos
  add column if not exists quantidade_mensalidades integer not null default 12,
  add column if not exists dia_vencimento integer not null default 10
    check (dia_vencimento between 1 and 28);

-- =========================================================
-- CONTRATOS — snapshot das condições contratadas
-- =========================================================
create sequence if not exists contratos_numero_seq start 1;

alter table contratos
  alter column numero set default ('CTA-' || lpad(nextval('contratos_numero_seq')::text, 6, '0')),
  add column if not exists quantidade_mensalidades integer not null default 1,
  add column if not exists status text not null default 'Ativo'
    check (status in ('Ativo', 'Finalizado', 'Cancelado'));

-- =========================================================
-- MENSALIDADES — vínculo ao contrato, dados da parcela e do pagamento
-- =========================================================
alter table mensalidades
  add column if not exists contrato_id uuid references contratos(id) on delete cascade,
  add column if not exists numero_parcela integer,
  add column if not exists total_parcelas integer,
  add column if not exists forma_pagamento text,
  add column if not exists gateway_charge_id text unique,
  add column if not exists pago_em timestamptz;

create index if not exists idx_mensalidades_contrato on mensalidades(contrato_id);
create index if not exists idx_mensalidades_gateway_charge on mensalidades(gateway_charge_id);

alter type mensalidade_status add value if not exists 'Em processamento';

-- =========================================================
-- ACESSO DO ASSOCIADO AO PORTAL
-- id = auth.users.id (1 login Supabase Auth por associado, mesma
-- estrutura de autenticação já usada pela equipe em `usuarios`).
-- =========================================================
create table if not exists associado_acessos (
  id uuid primary key references auth.users(id) on delete cascade,
  associado_id uuid not null unique references associados(id) on delete cascade,
  email text not null,
  status text not null default 'Ativo' check (status in ('Ativo', 'Bloqueado')),
  ultimo_acesso timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- FUNÇÕES AUXILIARES DE RLS (security definer — leem tabelas que o
-- chamador não tem acesso direto, só para decidir "quem é você")
-- =========================================================
create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from usuarios where id = auth.uid());
$$;

create or replace function current_associado_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select associado_id from associado_acessos where id = auth.uid() and status = 'Ativo';
$$;

-- =========================================================
-- REESCREVE as políticas "staff_full_access": antes `using (true)`
-- (qualquer autenticado), agora `using (is_staff())`.
-- =========================================================
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'usuarios', 'planos', 'associados', 'dependentes', 'contratos',
      'mensalidades', 'pagamentos', 'credenciais', 'tipos_ingresso',
      'ingressos', 'catracas', 'acessos', 'despesas', 'regras_acesso',
      'modelos_contrato', 'contratos_gerados', 'empresa'
    ])
  loop
    execute format('drop policy if exists "staff_full_access" on %I;', t);
    execute format(
      'create policy "staff_full_access" on %I for all to authenticated using (is_staff()) with check (is_staff());',
      t
    );
  end loop;
end $$;

-- =========================================================
-- POLÍTICAS DO PORTAL — leitura restrita ao próprio associado
-- =========================================================
alter table associado_acessos enable row level security;

create policy "staff_full_access" on associado_acessos
  for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy "portal_own_acesso" on associado_acessos
  for select to authenticated
  using (id = auth.uid());

create policy "portal_own_associado" on associados
  for select to authenticated
  using (id = current_associado_id());

create policy "portal_own_contratos" on contratos
  for select to authenticated
  using (associado_id = current_associado_id());

create policy "portal_own_mensalidades" on mensalidades
  for select to authenticated
  using (associado_id = current_associado_id());

create policy "portal_own_contratos_gerados" on contratos_gerados
  for select to authenticated
  using (associado_id = current_associado_id());

-- Planos e dados da empresa não são sensíveis (preço público / dados do
-- parque) — qualquer autenticado (staff ou associado) pode ler.
create policy "portal_read_planos" on planos
  for select to authenticated
  using (true);

create policy "portal_read_empresa" on empresa
  for select to authenticated
  using (true);
