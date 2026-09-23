-- Aqua Park Manager — integração com Autentique (assinatura eletrônica)
-- Rode este script no SQL Editor do Supabase.

-- Modelo padrão: usado para gerar e enviar o contrato automaticamente
-- quando um associado é cadastrado. Só pode existir um por vez.
alter table modelos_contrato add column padrao boolean not null default false;

create unique index modelos_contrato_padrao_unico on modelos_contrato (padrao) where padrao;

-- Id do documento na Autentique, usado pelo webhook para saber qual
-- contrato atualizar quando ele for assinado/recusado.
alter table contratos_gerados add column autentique_document_id text;

create index idx_contratos_gerados_autentique_document_id on contratos_gerados(autentique_document_id);
