-- Aqua Park Manager — dados iniciais
-- Rode este script DEPOIS de schema.sql e policies.sql no SQL Editor do Supabase.

create sequence if not exists associados_numero_seq start 1;

alter table associados
  alter column numero set default lpad(nextval('associados_numero_seq')::text, 6, '0');

insert into planos (nome, valor, dependentes_permitidos, beneficios) values
  ('Individual', 149.90, 0, array['Acesso ilimitado', 'Estacionamento']),
  ('Familiar', 349.90, 4, array['Acesso ilimitado', '4 dependentes', 'Estacionamento', 'Área vip']),
  ('Casal', 229.90, 1, array['Acesso ilimitado', '1 dependente']),
  ('Premium', 499.90, 6, array['Acesso ilimitado', '6 dependentes', 'Área vip', 'Toalhas inclusas']);

insert into tipos_ingresso (nome, descricao, valor, validade) values
  ('Diária Adulto', 'Acesso de um dia para visitantes adultos', 89.90, '1 dia'),
  ('Diária Infantil', 'Acesso de um dia para crianças de 3 a 11 anos', 59.90, '1 dia'),
  ('Diária Família (4 pessoas)', 'Combo família com desconto', 279.90, '1 dia'),
  ('Meia-entrada', 'Estudantes e idosos, mediante documento', 44.90, '1 dia');

insert into catracas (nome, identificacao, local, tipo, status) values
  ('Catraca 01', 'CAT-01', 'Portaria Principal', 'Entrada', 'Online'),
  ('Catraca 02', 'CAT-02', 'Acesso Lateral', 'Entrada', 'Online'),
  ('Catraca 03', 'CAT-03', 'Portaria Principal', 'Saída', 'Online'),
  ('Catraca 04', 'CAT-04', 'Acesso VIP', 'Bidirecional', 'Manutenção'),
  ('Catraca 05', 'CAT-05', 'Acesso Lateral', 'Saída', 'Offline');
