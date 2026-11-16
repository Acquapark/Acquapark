-- Aqua Park Manager — desconto automático para funcionários de empresa parceira
-- Rode este script no SQL Editor do Supabase, DEPOIS de cupons_plano.sql e
-- empresas_parceiras_codigo_cnpj.sql. Idempotente: pode rodar de novo.
--
-- Cada empresa parceira pode ter um cupom de plano (aplica_a 'planos' ou
-- 'ambos') como "desconto para funcionários". Quando o associado se vincula à
-- empresa — no cadastro pela internet (CNPJ confirmado) ou no painel — o cupom
-- dela entra sozinho no plano. Os descontos não se somam: com o cupom da
-- empresa, o cupom digitado pela pessoa é ignorado.
--
-- O cupom continua com as regras dele (validade, limite de usos, meses de
-- desconto). Cupom vencido, inativo ou esgotado: o funcionário se cadastra
-- normalmente, só sem o desconto.
--
-- Excluir o cupom só tira o desconto da empresa (on delete set null).

alter table empresas_parceiras
  add column if not exists cupom_id uuid references cupons_desconto(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Verificação (rode depois): deve mostrar a coluna cupom_id.
-- ---------------------------------------------------------------------------
-- select column_name from information_schema.columns where table_name = 'empresas_parceiras' and column_name = 'cupom_id';
