-- Aqua Park Manager — schema inicial do banco de dados (Supabase / PostgreSQL)
-- Rode este script no SQL Editor do seu projeto Supabase.
-- Este é o esqueleto de dados descrito no PRD (seção 22); RLS está habilitado
-- mas as políticas de acesso devem ser criadas conforme as permissões de cada perfil.

create extension if not exists "pgcrypto";

-- =========================================================
-- ENUMS
-- =========================================================
create type associado_status as enum ('Ativo', 'Pendente', 'Inadimplente', 'Suspenso', 'Inativo');
create type mensalidade_status as enum ('Pago', 'Pendente', 'Vencido', 'Cancelado');
create type acesso_tipo as enum ('Entrada', 'Saída', 'Reentrada');
create type acesso_resultado as enum ('Autorizado', 'Negado', 'Bloqueado');
create type ingresso_status as enum ('Disponível', 'Utilizado', 'Cancelado', 'Expirado');
create type catraca_status as enum ('Online', 'Offline', 'Manutenção');
create type perfil_usuario as enum ('Administrador', 'Gerente', 'Bilheteria', 'Recepção', 'Financeiro');
create type regra_reentrada as enum ('unica', 'reentrada', 'ilimitado');

-- =========================================================
-- USUÁRIOS (equipe do sistema)
-- =========================================================
create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  perfil perfil_usuario not null default 'Recepção',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================================================
-- PLANOS
-- =========================================================
create table planos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor numeric(10, 2) not null,
  dependentes_permitidos integer not null default 0,
  beneficios text[] not null default '{}',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================================================
-- ASSOCIADOS
-- =========================================================
create table associados (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  nome text not null,
  cpf text not null unique,
  rg text,
  nascimento date,
  sexo text,
  telefone text,
  whatsapp text,
  email text,
  cep text,
  endereco text,
  numero_endereco text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  foto_url text,
  observacoes text,
  plano_id uuid references planos(id),
  status associado_status not null default 'Pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_associados_status on associados(status);
create index idx_associados_cpf on associados(cpf);

-- =========================================================
-- DEPENDENTES
-- =========================================================
create table dependentes (
  id uuid primary key default gen_random_uuid(),
  associado_id uuid not null references associados(id) on delete cascade,
  nome text not null,
  cpf text,
  rg text,
  nascimento date,
  parentesco text not null,
  sexo text,
  foto_url text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_dependentes_associado on dependentes(associado_id);

-- =========================================================
-- CONTRATOS
-- =========================================================
create table contratos (
  id uuid primary key default gen_random_uuid(),
  associado_id uuid not null references associados(id) on delete cascade,
  numero text not null unique,
  data_contratacao date not null default current_date,
  data_inicio date not null,
  data_fim date,
  plano_id uuid references planos(id),
  valor numeric(10, 2) not null,
  observacoes text,
  documento_url text,
  created_at timestamptz not null default now()
);

create index idx_contratos_associado on contratos(associado_id);

-- =========================================================
-- MENSALIDADES
-- =========================================================
create table mensalidades (
  id uuid primary key default gen_random_uuid(),
  associado_id uuid not null references associados(id) on delete cascade,
  vencimento date not null,
  valor numeric(10, 2) not null,
  status mensalidade_status not null default 'Pendente',
  created_at timestamptz not null default now()
);

create index idx_mensalidades_associado on mensalidades(associado_id);
create index idx_mensalidades_status on mensalidades(status);

-- =========================================================
-- PAGAMENTOS
-- =========================================================
create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  mensalidade_id uuid references mensalidades(id) on delete set null,
  ingresso_id uuid,
  valor numeric(10, 2) not null,
  forma_pagamento text not null,
  referencia text,
  usuario_id uuid references usuarios(id),
  pago_em timestamptz not null default now()
);

-- =========================================================
-- CREDENCIAIS (associados) — identificador opaco, sem dados pessoais no QR
-- =========================================================
create table credenciais (
  id uuid primary key default gen_random_uuid(),
  associado_id uuid not null references associados(id) on delete cascade,
  codigo text not null unique default encode(gen_random_bytes(16), 'hex'),
  regra_reentrada regra_reentrada not null default 'reentrada',
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_credenciais_codigo on credenciais(codigo);

-- =========================================================
-- TIPOS DE INGRESSO / INGRESSOS
-- =========================================================
create table tipos_ingresso (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  valor numeric(10, 2) not null,
  validade text not null default '1 dia',
  regras text,
  quantidade_disponivel integer,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table ingressos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  tipo_id uuid not null references tipos_ingresso(id),
  comprador_nome text,
  data_utilizacao date not null,
  valor numeric(10, 2) not null,
  status ingresso_status not null default 'Disponível',
  codigo text not null unique default encode(gen_random_bytes(16), 'hex'),
  regra_reentrada regra_reentrada not null default 'unica',
  created_at timestamptz not null default now()
);

create index idx_ingressos_codigo on ingressos(codigo);

alter table pagamentos
  add constraint pagamentos_ingresso_fk foreign key (ingresso_id) references ingressos(id) on delete set null;

-- =========================================================
-- CATRACAS
-- =========================================================
create table catracas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  identificacao text not null unique,
  local text,
  tipo text not null default 'Entrada',
  status catraca_status not null default 'Offline',
  configuracao jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- =========================================================
-- ACESSOS (log de leituras)
-- =========================================================
create table acessos (
  id uuid primary key default gen_random_uuid(),
  credencial_id uuid references credenciais(id),
  ingresso_id uuid references ingressos(id),
  catraca_id uuid references catracas(id),
  tipo acesso_tipo not null,
  resultado acesso_resultado not null,
  motivo text,
  registrado_em timestamptz not null default now(),
  constraint acesso_origem_check check (credencial_id is not null or ingresso_id is not null)
);

create index idx_acessos_credencial on acessos(credencial_id);
create index idx_acessos_ingresso on acessos(ingresso_id);
create index idx_acessos_registrado_em on acessos(registrado_em);

-- =========================================================
-- DESPESAS
-- =========================================================
create table despesas (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  categoria text not null,
  valor numeric(10, 2) not null,
  vencimento date not null,
  status text not null default 'Pendente',
  observacoes text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- REGRAS DE ACESSO (configuráveis, não fixas em código)
-- =========================================================
create table regras_acesso (
  id boolean primary key default true,
  bloquear_inadimplente boolean not null default true,
  regra_reentrada_padrao regra_reentrada not null default 'reentrada',
  tolerancia_minutos integer not null default 3,
  constraint regras_acesso_singleton check (id)
);

insert into regras_acesso (id) values (true);

-- =========================================================
-- RLS — habilitado; políticas devem ser definidas por perfil (ver módulo Permissões)
-- =========================================================
alter table usuarios enable row level security;
alter table planos enable row level security;
alter table associados enable row level security;
alter table dependentes enable row level security;
alter table contratos enable row level security;
alter table mensalidades enable row level security;
alter table pagamentos enable row level security;
alter table credenciais enable row level security;
alter table tipos_ingresso enable row level security;
alter table ingressos enable row level security;
alter table catracas enable row level security;
alter table acessos enable row level security;
alter table despesas enable row level security;
alter table regras_acesso enable row level security;
