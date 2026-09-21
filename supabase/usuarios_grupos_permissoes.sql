-- Aqua Park Manager — grupos de acesso e permissões configuráveis
-- Rode este script no SQL Editor do Supabase (idempotente).
--
-- Antes: cada usuário da equipe tinha um `perfil` de um enum fixo no banco.
-- Agora: grupos criados e editados pela própria interface (Configurações >
-- Grupos e Permissões). Cada grupo tem um conjunto de permissões do tipo
-- "recurso.acao" (ex: associados.criar, despesas.excluir). O CATÁLOGO do que
-- pode ser liberado fica em src/lib/permissoes.ts (cada permissão precisa de
-- código que a aplique); quais permissões cada grupo tem fica aqui, no banco.
--
-- Escrita nestas tabelas só acontece por Server Actions (service role), que
-- validam a permissão de quem chama; o RLS abaixo só libera LEITURA à equipe.

-- =========================================================
-- GRUPOS
-- =========================================================
create table if not exists grupos_acesso (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  -- Grupo com acesso total (Administrador): tem TODAS as permissões, inclusive
  -- as que forem criadas no futuro. Não pode ser excluído nem ter permissões editadas.
  acesso_total boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists grupos_acesso_nome_unico on grupos_acesso (lower(nome));

create table if not exists grupo_permissoes (
  grupo_id uuid not null references grupos_acesso(id) on delete cascade,
  permissao text not null,
  primary key (grupo_id, permissao)
);

-- =========================================================
-- USUÁRIOS -> GRUPO
-- =========================================================
alter table usuarios add column if not exists grupo_id uuid references grupos_acesso(id) on delete restrict;
create index if not exists usuarios_grupo_idx on usuarios (grupo_id);

-- O enum `perfil` deixa de ser usado (mantido só como histórico).
alter table usuarios alter column perfil drop not null;
alter table usuarios alter column perfil drop default;

-- =========================================================
-- GRUPOS PADRÃO (equivalentes aos antigos perfis) — só na primeira execução
-- =========================================================
do $$
declare
  g_admin uuid;
  g_gerente uuid;
  g_bilheteria uuid;
  g_recepcao uuid;
  g_financeiro uuid;
begin
  if exists (select 1 from grupos_acesso) then
    return;
  end if;

  insert into grupos_acesso (nome, descricao, acesso_total)
  values ('Administrador', 'Acesso total ao sistema, incluindo tudo o que for criado no futuro.', true)
  returning id into g_admin;

  insert into grupos_acesso (nome, descricao)
  values ('Gerente', 'Todos os módulos operacionais; sem acesso às Configurações.')
  returning id into g_gerente;

  insert into grupos_acesso (nome, descricao)
  values ('Bilheteria', 'Venda de ingressos, caixa e portaria.')
  returning id into g_bilheteria;

  insert into grupos_acesso (nome, descricao)
  values ('Recepção', 'Atendimento de associados e portaria.')
  returning id into g_recepcao;

  insert into grupos_acesso (nome, descricao)
  values ('Financeiro', 'Contas a receber, despesas e relatórios financeiros.')
  returning id into g_financeiro;

  insert into grupo_permissoes (grupo_id, permissao)
  select g_gerente, unnest(array[
    'dashboard.visualizar',
    'associados.visualizar', 'associados.criar', 'associados.editar', 'associados.excluir', 'associados.alterar_status',
    'dependentes.visualizar', 'dependentes.criar', 'dependentes.excluir',
    'planos_associado.visualizar', 'planos_associado.criar',
    'credenciais.visualizar', 'credenciais.criar', 'credenciais.editar',
    'acesso_portal.visualizar', 'acesso_portal.criar', 'acesso_portal.editar',
    'ingressos.visualizar', 'ingressos.criar', 'ingressos.cancelar', 'ingressos.imprimir',
    'caixa.visualizar', 'caixa.abrir', 'caixa.movimentar', 'caixa.fechar', 'caixa.reabrir', 'caixa.ver_todos',
    'controle_acesso.visualizar', 'controle_acesso.validar',
    'contas_receber.visualizar', 'contas_receber.receber',
    'recebimentos.visualizar',
    'despesas.visualizar', 'despesas.criar', 'despesas.editar', 'despesas.excluir', 'despesas.pagar',
    'fluxo_caixa.visualizar',
    'modelos_contrato.visualizar', 'modelos_contrato.criar', 'modelos_contrato.editar', 'modelos_contrato.excluir',
    'contratos_gerados.visualizar', 'contratos_gerados.criar',
    'relatorio_vendas.visualizar', 'relatorio_entradas.visualizar', 'relatorio_saidas.visualizar',
    'relatorio_associados.visualizar', 'relatorio_inadimplencia.visualizar', 'relatorio_faturamento.visualizar',
    'relatorio_utilizacao.visualizar', 'relatorio_pagamentos.visualizar', 'relatorio_acessos.visualizar',
    'exportacao_relatorios.exportar'
  ]);

  insert into grupo_permissoes (grupo_id, permissao)
  select g_bilheteria, unnest(array[
    'dashboard.visualizar',
    'ingressos.visualizar', 'ingressos.criar', 'ingressos.cancelar', 'ingressos.imprimir',
    'caixa.visualizar', 'caixa.abrir', 'caixa.movimentar', 'caixa.fechar',
    'controle_acesso.visualizar', 'controle_acesso.validar'
  ]);

  insert into grupo_permissoes (grupo_id, permissao)
  select g_recepcao, unnest(array[
    'dashboard.visualizar',
    'associados.visualizar', 'associados.criar', 'associados.editar',
    'dependentes.visualizar', 'dependentes.criar',
    'planos_associado.visualizar',
    'credenciais.visualizar', 'credenciais.criar',
    'controle_acesso.visualizar', 'controle_acesso.validar'
  ]);

  insert into grupo_permissoes (grupo_id, permissao)
  select g_financeiro, unnest(array[
    'dashboard.visualizar',
    'associados.visualizar',
    'contas_receber.visualizar', 'contas_receber.receber',
    'recebimentos.visualizar',
    'despesas.visualizar', 'despesas.criar', 'despesas.editar', 'despesas.excluir', 'despesas.pagar',
    'fluxo_caixa.visualizar',
    'relatorio_vendas.visualizar', 'relatorio_associados.visualizar', 'relatorio_inadimplencia.visualizar',
    'relatorio_faturamento.visualizar', 'relatorio_pagamentos.visualizar',
    'exportacao_relatorios.exportar'
  ]);
end $$;

-- Usuários existentes entram no grupo de mesmo nome do antigo perfil.
update usuarios u
set grupo_id = g.id
from grupos_acesso g
where u.grupo_id is null
  and u.perfil is not null
  and lower(g.nome) = lower(u.perfil::text);

-- =========================================================
-- RLS
-- =========================================================
-- Usuário inativo perde o acesso ao banco na hora (is_staff() alimenta todas as políticas).
create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from usuarios where id = auth.uid() and ativo);
$$;

alter table grupos_acesso enable row level security;
alter table grupo_permissoes enable row level security;

drop policy if exists "staff_le_grupos" on grupos_acesso;
create policy "staff_le_grupos" on grupos_acesso for select to authenticated using (is_staff());

drop policy if exists "staff_le_grupo_permissoes" on grupo_permissoes;
create policy "staff_le_grupo_permissoes" on grupo_permissoes for select to authenticated using (is_staff());

-- `usuarios` deixa de ser gravável pelo navegador (com a chave pública, qualquer
-- membro da equipe poderia se colocar no grupo Administrador). Leitura continua
-- liberada à equipe; criar/editar/excluir usuário só pelas Server Actions.
drop policy if exists "staff_full_access" on usuarios;
drop policy if exists "staff_le_usuarios" on usuarios;
create policy "staff_le_usuarios" on usuarios for select to authenticated using (is_staff());
