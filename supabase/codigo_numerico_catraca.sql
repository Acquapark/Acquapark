-- A catraca física só lê QR Codes puramente numéricos (sem letras/símbolos)
-- de até 14 dígitos. O código de cada ingresso vinha de
-- `encode(gen_random_bytes(16), 'hex')` (32 caracteres hexadecimais, com
-- letras a-f) — nunca teria sido lido pela catraca. Troca por 14 dígitos
-- aleatórios (mesmo espaço de 10^14 combinações, só que em base decimal),
-- mantendo a coluna `unique` como já era.
alter table ingressos
  alter column codigo set default lpad(floor(random() * 1e14)::bigint::text, 14, '0');

-- Os 2 ingressos já existentes (ainda "Disponível", nunca usados) ficam com
-- o código antigo em hexadecimal — sem esse update, continuariam ilegíveis
-- na catraca mesmo depois da mudança acima (que só vale para novos ingressos).
update ingressos
  set codigo = lpad(floor(random() * 1e14)::bigint::text, 14, '0')
  where codigo !~ '^[0-9]+$' or length(codigo) > 14;

-- Mesmo problema na credencial do associado (lida na mesma catraca). Não há
-- nenhuma credencial cadastrada ainda, então só troca o padrão — não precisa
-- de UPDATE em linhas existentes.
alter table credenciais
  alter column codigo set default lpad(floor(random() * 1e14)::bigint::text, 14, '0');
