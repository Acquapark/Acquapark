-- Aqua Park Manager — código da empresa parceira passa a ser o CNPJ
-- Rode este script no SQL Editor do Supabase, DEPOIS de empresas_parceiras_codigo.sql.
-- Idempotente: pode rodar de novo sem problema.
--
-- Na página pública /cadastro o funcionário agora digita o CNPJ da empresa
-- (só os 14 números ficam gravados em "codigo") em vez do código aleatório.
-- O painel passa a exigir o CNPJ e grava o código sozinho ao salvar.
--
-- Empresas já cadastradas COM CNPJ completo ganham o CNPJ como código agora.
-- As que estão SEM CNPJ (ou com CNPJ incompleto) continuam com o código
-- aleatório antigo até alguém editar a empresa no painel e preencher o CNPJ.

-- Antes de rodar: o mesmo CNPJ não pode estar em duas empresas (o código é
-- único). Esta consulta deve voltar vazia — se voltar algo, corrija no painel.
-- select regexp_replace(cnpj, '\D', '', 'g') as cnpj, string_agg(nome, ', ') as empresas
-- from empresas_parceiras
-- where length(regexp_replace(coalesce(cnpj, ''), '\D', '', 'g')) = 14
-- group by 1 having count(*) > 1;

update empresas_parceiras
set codigo = regexp_replace(cnpj, '\D', '', 'g'),
    updated_at = now()
where length(regexp_replace(coalesce(cnpj, ''), '\D', '', 'g')) = 14
  and codigo is distinct from regexp_replace(cnpj, '\D', '', 'g');

-- ---------------------------------------------------------------------------
-- Verificação (rode depois): empresas com código diferente do CNPJ ainda
-- precisam ter o CNPJ preenchido no painel.
-- ---------------------------------------------------------------------------
-- select nome, cnpj, codigo from empresas_parceiras
-- where codigo is distinct from regexp_replace(coalesce(cnpj, ''), '\D', '', 'g')
-- order by nome;
