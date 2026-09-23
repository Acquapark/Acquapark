-- Aqua Park Manager — cobrança Asaas antecipada (criada no momento da adesão)
-- Rode este script no SQL Editor do Supabase.
--
-- Reaproveita mensalidades.gateway_charge_id (id da cobrança) e
-- associados.asaas_customer_id/asaas_customer_env (cliente) — não duplica.
-- Só adiciona o que ainda não existe: status bruto da Asaas (separado do
-- status de negócio local), link da fatura, controle de sincronização e
-- auditoria do cancelamento.

alter table mensalidades
  add column if not exists asaas_billing_type text,
  add column if not exists asaas_status text,
  add column if not exists asaas_invoice_url text,
  add column if not exists asaas_last_sync_at timestamptz,
  add column if not exists asaas_sync_error text,
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_por uuid references usuarios(id);
