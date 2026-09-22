-- Aqua Park Manager — associado pode ver a própria credencial no Portal
-- Rode este script no SQL Editor do Supabase.
--
-- `credenciais` só tinha a política staff_full_access (is_staff()) — o
-- associado nunca conseguia ler a própria linha, então qualquer consulta
-- feita a partir do Portal (join com `credenciais`) vinha vazia.

create policy "portal_own_credencial" on credenciais
  for select to authenticated
  using (associado_id = current_associado_id());
