-- Aqua Park Manager — integração com o Asaas (gateway de pagamento)
-- Rode este script no SQL Editor do Supabase.

-- Cache do cliente já criado no Asaas para este associado, para não criar um
-- cliente novo a cada cobrança (nome/CPF já cadastrados aqui, evita duplicar).
alter table associados add column if not exists asaas_customer_id text;
