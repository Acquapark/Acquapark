-- Aqua Park Manager — cards do Dashboard por grupo + excluir recebimento
-- Rode este script no SQL Editor do Supabase.
--
-- Cada card do Dashboard virou uma permissão (Configurações → Grupos e
-- permissões). Para nada sumir de quem já usa o Dashboard, todo grupo que já
-- podia abrir o Dashboard recebe todos os cards; depois é só desmarcar os que
-- o grupo não deve ver. O grupo com acesso total (Administrador) não precisa:
-- ele já tem todas as permissões.
--
-- A permissão nova "recebimentos.excluir" NÃO é dada a ninguém aqui (além do
-- Administrador, que tem tudo): libere para os grupos que devem poder excluir.

insert into grupo_permissoes (grupo_id, permissao)
select gp.grupo_id, card.permissao
from grupo_permissoes gp
cross join (
  values
    ('dashboard_entradas_hoje.visualizar'),
    ('dashboard_associados_ativos.visualizar'),
    ('dashboard_ingressos_hoje.visualizar'),
    ('dashboard_faturamento_mes.visualizar'),
    ('dashboard_mensalidades_aberto.visualizar'),
    ('dashboard_grafico_entradas.visualizar'),
    ('dashboard_grafico_faturamento.visualizar'),
    ('dashboard_entradas_recentes.visualizar'),
    ('dashboard_ultimos_pagamentos.visualizar'),
    ('dashboard_mensalidades_atraso.visualizar'),
    ('dashboard_ingressos_recentes.visualizar'),
    ('dashboard_despesas_proximas.visualizar')
) as card(permissao)
where gp.permissao = 'dashboard.visualizar'
on conflict (grupo_id, permissao) do nothing;
