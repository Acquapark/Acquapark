-- Aqua Park Manager — módulo Financeiro (despesas reais)
-- Rode este script DEPOIS de caixa_module.sql.
--
-- A tabela `despesas` já existia (sem uso). Aqui ela ganha os campos de
-- pagamento e fornecedor e o status passa a aceitar só 'Pendente' e 'Pago'.
-- "Vencido" não é gravado: é calculado (Pendente com vencimento no passado).

alter table despesas
  add column if not exists fornecedor text,
  add column if not exists pago_em date,
  add column if not exists forma_pagamento text;

update despesas set status = 'Pendente' where status not in ('Pendente', 'Pago');

alter table despesas drop constraint if exists despesas_status_check;
alter table despesas
  add constraint despesas_status_check check (status in ('Pendente', 'Pago'));

create index if not exists idx_despesas_vencimento on despesas (vencimento);
create index if not exists idx_despesas_pago_em on despesas (pago_em);
create index if not exists idx_pagamentos_pago_em on pagamentos (pago_em);
