-- Aqua Park Manager — regra de vencimento da 1ª parcela por plano
-- Rode este script DEPOIS de portal_module.sql.
--
-- Hoje a 1ª parcela sempre segue o dia de vencimento padrão do plano
-- (calcularPrimeiroVencimento em src/lib/mensalidades-engine.ts). Este script
-- adiciona uma configuração no plano para escolher como a 1ª parcela é
-- definida, sem alterar o comportamento padrão existente (default 'padrao'
-- preserva 100% do fluxo atual). A regra usada é gravada também no contrato
-- (snapshot), seguindo o mesmo padrão já usado para valor/quantidade de
-- mensalidades — editar o plano depois não afeta contratos já criados.

alter table planos
  add column if not exists regra_primeira_parcela text not null default 'padrao'
    check (regra_primeira_parcela in ('padrao', 'adesao', 'manual'));

alter table contratos
  add column if not exists regra_primeira_parcela text not null default 'padrao'
    check (regra_primeira_parcela in ('padrao', 'adesao', 'manual'));
