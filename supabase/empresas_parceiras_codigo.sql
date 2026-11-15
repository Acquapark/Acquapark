-- Aqua Park Manager — código de validação das empresas parceiras
-- Rode este script no SQL Editor do Supabase, DEPOIS de empresas_parceiras.sql.
-- Idempotente: pode rodar de novo sem problema.
--
-- Na página pública /cadastro a pessoa só se vincula a uma empresa parceira
-- digitando o código dela (o parque passa o código à empresa, que repassa aos
-- funcionários). Assim ninguém se diz "da empresa" sem ser.
--
-- Formato: 8 caracteres de 0-9 e A-F (sem O, I ou L para não confundir).
-- O painel gera um novo código quando a equipe clica em "Gerar novo código" —
-- o antigo para de valer na hora.

alter table empresas_parceiras add column if not exists codigo text;

-- Empresas já cadastradas ganham um código agora.
update empresas_parceiras
set codigo = upper(substr(md5(random()::text || id::text || clock_timestamp()::text), 1, 8))
where codigo is null;

alter table empresas_parceiras alter column codigo set not null;
create unique index if not exists idx_empresas_parceiras_codigo on empresas_parceiras (codigo);

-- O limite de tentativas da página pública passa a separar o tipo: conferir
-- código de empresa tem limite próprio e não gasta as tentativas de cadastro.
alter table autocadastro_tentativas add column if not exists tipo text not null default 'cadastro';
create index if not exists idx_autocadastro_tentativas_tipo on autocadastro_tentativas(ip, tipo, criado_em);

-- ---------------------------------------------------------------------------
-- Verificação (rode depois): todas as empresas devem aparecer com um código.
-- ---------------------------------------------------------------------------
-- select nome, codigo from empresas_parceiras order by nome;
