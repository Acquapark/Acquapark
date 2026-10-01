-- Aqua Park Manager — termos de adesão + pausa do contrato automático
-- Rode este script no SQL Editor do Supabase, DEPOIS de autocadastro.sql.
--
-- 1. Chave para ligar/desligar o contrato automático (documento enviado para
--    assinatura na Autentique). Começa DESLIGADA. O contrato do plano (que gera
--    as mensalidades) não é afetado.
-- 2. Termos de adesão versionados: cada publicação é uma versão nova e
--    imutável. Só a equipe publica; associados logados podem ler.
-- 3. Registro do aceite: quem aceitou, qual versão, quando, IP, navegador e por
--    onde. Gravado só pelo servidor (service role) — sem política de escrita.
alter table empresa
  add column if not exists contrato_automatico boolean not null default false;

create table if not exists termos_versoes (
  id uuid primary key default gen_random_uuid(),
  versao integer not null unique,
  conteudo text not null,
  publicado_em timestamptz not null default now(),
  publicado_por uuid references usuarios(id)
);

create table if not exists termos_aceites (
  id uuid primary key default gen_random_uuid(),
  associado_id uuid not null references associados(id) on delete cascade,
  versao_id uuid not null references termos_versoes(id),
  aceito_em timestamptz not null default now(),
  ip text,
  user_agent text,
  origem text not null check (origem in ('autocadastro', 'portal')),
  unique (associado_id, versao_id)
);

create index if not exists idx_termos_aceites_associado on termos_aceites(associado_id, aceito_em desc);

alter table termos_versoes enable row level security;
alter table termos_aceites enable row level security;

-- Termos: equipe lê e publica; associado logado no Portal lê.
create policy "staff_full_access" on termos_versoes
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy "portal_read_termos" on termos_versoes
  for select to authenticated
  using (current_associado_id() is not null);

-- Aceites: equipe lê todos; associado lê os próprios. Escrita só pelo servidor.
create policy "staff_read_aceites" on termos_aceites
  for select to authenticated
  using (is_staff());

create policy "portal_own_aceites" on termos_aceites
  for select to authenticated
  using (associado_id = current_associado_id());
