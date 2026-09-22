-- Aqua Park Manager — separa o cache do cliente Asaas por ambiente
-- Rode este script no SQL Editor do Supabase.
--
-- Sandbox e produção são contas completamente separadas no Asaas: um
-- asaas_customer_id criado no sandbox não existe do lado da produção (e
-- vice-versa). Sem saber em qual ambiente cada id foi criado, o sistema podia
-- reaproveitar um cliente do ambiente errado e a cobrança falhava com
-- "Customer inválido ou não informado".

alter table associados add column if not exists asaas_customer_env text check (asaas_customer_env in ('sandbox', 'production'));

-- Qualquer asaas_customer_id já salvo antes desta coluna existir foi criado
-- durante os testes em sandbox desta integração — limpa para ser recriado
-- (no ambiente certo) na próxima cobrança de cada associado.
update associados set asaas_customer_id = null where asaas_customer_id is not null and asaas_customer_env is null;
