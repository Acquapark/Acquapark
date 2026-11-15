-- Aqua Park Manager — empresas parceiras
-- Rode este script no SQL Editor do Supabase (idempotente: pode rodar de novo).
--
-- Empresas que têm parceria com o parque e indicam funcionários para se
-- associarem. Por enquanto a empresa só identifica de onde o associado veio
-- (filtros e relatório); não muda plano nem valor.
--
-- Não confundir com a tabela `empresa` (singular), que guarda os dados do
-- próprio parque usados nos contratos.

create table if not exists empresas_parceiras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  contato_nome text,
  telefone text,
  email text,
  observacoes text,
  -- Inativa: some da lista do cadastro (painel e internet), mas os associados
  -- já vinculados continuam mostrando a empresa.
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nome único sem diferenciar maiúsculas/minúsculas e espaços nas pontas.
create unique index if not exists idx_empresas_parceiras_nome on empresas_parceiras (lower(trim(nome)));

alter table empresas_parceiras enable row level security;
drop policy if exists "staff_full_access" on empresas_parceiras;
create policy "staff_full_access" on empresas_parceiras
  for all to authenticated using (is_staff()) with check (is_staff());
-- A página pública /cadastro lê a lista pelo servidor (service role), então
-- não há política para visitantes.

-- Vínculo do associado com a empresa (opcional). Sem "on delete": uma empresa
-- com associados vinculados não pode ser excluída, só inativada — assim o
-- histórico de quem veio de cada empresa nunca se perde.
alter table associados
  add column if not exists empresa_parceira_id uuid references empresas_parceiras(id);

create index if not exists idx_associados_empresa_parceira on associados(empresa_parceira_id);

-- ---------------------------------------------------------------------------
-- Verificação (rode depois; deve mostrar 1 linha em cada consulta)
-- ---------------------------------------------------------------------------
-- select count(*) as tabela_criada from information_schema.tables where table_name = 'empresas_parceiras';
-- select column_name from information_schema.columns where table_name = 'associados' and column_name = 'empresa_parceira_id';
