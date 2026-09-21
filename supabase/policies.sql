-- Aqua Park Manager — políticas de RLS iniciais
-- Rode este script DEPOIS de schema.sql no SQL Editor do Supabase.
--
-- Abordagem inicial (grosseira, pensada para destravar o desenvolvimento):
-- qualquer usuário AUTENTICADO (membro da equipe logado via Supabase Auth)
-- tem acesso total de leitura/escrita; o público anônimo não acessa nada.
-- O módulo Configurações > Permissões do sistema é responsável pela UI de
-- controle fino por perfil; refinar estas políticas por perfil (usando a
-- tabela `usuarios.perfil`) é um passo futuro, não bloqueante para o MVP.

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'usuarios', 'planos', 'associados', 'dependentes', 'contratos',
      'mensalidades', 'pagamentos', 'credenciais', 'tipos_ingresso',
      'ingressos', 'catracas', 'acessos', 'despesas', 'regras_acesso'
    ])
  loop
    execute format(
      'create policy "staff_full_access" on %I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- Usuários autenticados podem ler/atualizar apenas o próprio registro em "usuarios"
-- caso a política acima seja restringida futuramente; mantida aqui como referência.
-- (Não é necessária enquanto a política staff_full_access estiver ativa.)
