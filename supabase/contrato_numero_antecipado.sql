-- Permite reservar o próximo número de contrato ANTES de inserir a linha em
-- contratos_gerados, pra poder usar {{contrato.numero}} na checagem de campos
-- obrigatórios e no HTML substituído (hoje esse número só existia depois do
-- insert, então {{contrato.numero}} sempre ficava vazio e travava a geração
-- sempre que o modelo usasse essa variável — nem no cadastro automático, nem
-- no botão "Gerar contrato" manual). Usa exatamente o mesmo formato do
-- default da coluna `numero` em contratos_gerados (contratos_module.sql).
create or replace function proximo_numero_contrato()
returns text
language sql
security invoker
set search_path = public
as $$
  select 'CTR-' || lpad(nextval('contratos_gerados_numero_seq')::text, 6, '0');
$$;
