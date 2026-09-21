-- Aqua Park Manager — separa o endereço da empresa em campos estruturados
-- (mesmo padrão já usado em `associados`: endereco, numero, complemento,
-- bairro, cidade, estado, cep), em vez de um único campo de texto livre.
-- Rode este script depois de contratos_module.sql.

alter table empresa
  add column if not exists numero_endereco text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists cep text;
