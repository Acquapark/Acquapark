-- Aqua Park Manager — plano com vencimento na data da contratação
-- Rode este script DEPOIS de mensalidades_primeira_parcela.sql.
--
-- Com a flag ligada, TODAS as parcelas vencem no mesmo dia do mês da data de
-- contratação (contratou dia 21/09: 21/09, 21/10, 21/11...). O dia de
-- vencimento fixo do plano e a regra da "primeira parcela" deixam de valer.
-- Meses mais curtos usam o último dia (contratou dia 31: 28/02, 31/03, 30/04...).
--
-- A flag é copiada para o contrato no momento da adesão (snapshot), então
-- alterar o plano depois não muda contratos já existentes.
-- Default false: nenhum plano nem contrato existente muda de comportamento.

alter table planos
  add column if not exists vencimento_na_contratacao boolean not null default false;

alter table contratos
  add column if not exists vencimento_na_contratacao boolean not null default false;
