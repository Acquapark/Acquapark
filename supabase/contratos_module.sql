-- Aqua Park Manager — módulo Contratos (modelos + geração)
-- Rode este script DEPOIS de schema.sql, policies.sql e seed.sql no SQL Editor do Supabase.

create type modelo_contrato_status as enum ('Ativo', 'Inativo');
create type contrato_gerado_status as enum (
  'Rascunho', 'Gerado', 'Enviado para assinatura', 'Assinado', 'Recusado', 'Cancelado'
);

-- =========================================================
-- MODELOS DE CONTRATO
-- =========================================================
create table modelos_contrato (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  tipo text not null default 'Associação',
  status modelo_contrato_status not null default 'Ativo',
  versao integer not null default 1,
  conteudo_html text not null default '',
  arquivo_original_nome text,
  arquivo_original_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- CONTRATOS GERADOS
-- Cada linha guarda uma cópia resolvida (variáveis já substituídas) do
-- conteúdo no momento da geração — editar o modelo depois NÃO altera
-- contratos já gerados (exigência do PRD, seção 17).
-- =========================================================
create sequence if not exists contratos_gerados_numero_seq start 1;

create table contratos_gerados (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default ('CTR-' || lpad(nextval('contratos_gerados_numero_seq')::text, 6, '0')),
  associado_id uuid not null references associados(id) on delete cascade,
  modelo_id uuid references modelos_contrato(id) on delete set null,
  modelo_nome text not null,
  modelo_versao integer not null,
  data_contrato date not null default current_date,
  conteudo_html text not null,
  status contrato_gerado_status not null default 'Gerado',
  gerado_por uuid references usuarios(id),
  gerado_em timestamptz not null default now(),
  enviado_em timestamptz,
  assinado_em timestamptz,
  documento_assinado_url text
);

create index idx_contratos_gerados_associado on contratos_gerados(associado_id);

-- =========================================================
-- EMPRESA (dados do parque) — singleton usado nas variáveis {{empresa.*}}
-- e na tela Configurações > Dados do Parque.
-- =========================================================
create table empresa (
  id boolean primary key default true,
  nome text not null default 'Aqua Park',
  razao_social text,
  cnpj text,
  telefone text,
  email text,
  endereco text,
  logo_url text,
  constraint empresa_singleton check (id)
);

insert into empresa (id) values (true);

-- =========================================================
-- STORAGE — arquivos .docx originais enviados como base dos modelos
-- =========================================================
insert into storage.buckets (id, name, public)
values ('contratos-modelos', 'contratos-modelos', false)
on conflict (id) do nothing;

create policy "staff_read_modelos_bucket" on storage.objects
  for select to authenticated
  using (bucket_id = 'contratos-modelos');

create policy "staff_write_modelos_bucket" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'contratos-modelos');

create policy "staff_update_modelos_bucket" on storage.objects
  for update to authenticated
  using (bucket_id = 'contratos-modelos');

create policy "staff_delete_modelos_bucket" on storage.objects
  for delete to authenticated
  using (bucket_id = 'contratos-modelos');

-- =========================================================
-- RLS — mesmo padrão do restante do sistema (equipe autenticada = acesso total)
-- =========================================================
alter table modelos_contrato enable row level security;
alter table contratos_gerados enable row level security;
alter table empresa enable row level security;

create policy "staff_full_access" on modelos_contrato for all to authenticated using (true) with check (true);
create policy "staff_full_access" on contratos_gerados for all to authenticated using (true) with check (true);
create policy "staff_full_access" on empresa for all to authenticated using (true) with check (true);
