-- Aqua Park Manager — cortesia mensal do associado
-- Rode este script no SQL Editor do Supabase, DEPOIS de termos_adesao.sql.
--
-- Todo associado Ativo com plano pode resgatar 1 ingresso de cortesia por mês
-- (pelo Portal ou pelo painel). A cortesia é um ingresso normal, de valor zero,
-- ligado ao associado — a catraca, a impressão e a Bilheteria funcionam igual.
--
-- 1. Qual tipo de ingresso é a cortesia (escolhido em Configurações → Tipos de
--    Ingresso). Sem tipo escolhido, o resgate fica indisponível.
-- 2. Ingresso ganha o associado que resgatou e o mês da cortesia (AAAA-MM).
-- 3. O limite de 1 por mês é garantido pelo banco: índice único por associado
--    e mês, ignorando cortesias canceladas (cancelar libera o mês de novo).

alter table empresa
  add column if not exists cortesia_tipo_id uuid references tipos_ingresso(id) on delete set null;

alter table ingressos
  add column if not exists associado_id uuid references associados(id) on delete set null,
  add column if not exists cortesia_mes text;

create unique index if not exists ingressos_cortesia_unica_por_mes
  on ingressos (associado_id, cortesia_mes)
  where cortesia_mes is not null and status <> 'Cancelado';

create index if not exists idx_ingressos_associado on ingressos(associado_id) where associado_id is not null;
