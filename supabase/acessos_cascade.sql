-- Aqua Park Manager — corrige a exclusão de associado travada pelo histórico de acessos
-- Rode este script no SQL Editor do Supabase.
--
-- Excluir um associado já apaga em cascata dependentes, contratos, mensalidades,
-- credenciais etc. — menos os registros de `acessos` (catraca), porque essa
-- referência foi criada sem "on delete cascade". Resultado: a exclusão falhava
-- na hora de apagar a credencial, travada pelo próprio histórico de acessos
-- dela ("violates foreign key constraint acessos_credencial_id_fkey").

alter table acessos drop constraint if exists acessos_credencial_id_fkey;
alter table acessos
  add constraint acessos_credencial_id_fkey
  foreign key (credencial_id) references credenciais(id) on delete cascade;

-- Mesmo problema valeria para excluir um ingresso — corrige por consistência.
alter table acessos drop constraint if exists acessos_ingresso_id_fkey;
alter table acessos
  add constraint acessos_ingresso_id_fkey
  foreign key (ingresso_id) references ingressos(id) on delete cascade;
