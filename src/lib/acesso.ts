import type { SupabaseClient } from "@supabase/supabase-js";
import type { AcessoUsuario } from "./permissoes";

/**
 * Carrega quem é o usuário da equipe e o que o grupo dele permite, numa única
 * ida ao banco. Retorna null se a pessoa não é da equipe ou está inativa
 * (o RLS já esconde a linha de `usuarios` de quem está inativo).
 *
 * Sem "server-only": o proxy também usa isto.
 */
export async function carregarAcesso(supabase: SupabaseClient, userId: string): Promise<AcessoUsuario | null> {
  const { data } = await supabase
    .from("usuarios")
    .select("id, nome, email, ativo, grupo_id, grupos_acesso ( id, nome, acesso_total, grupo_permissoes ( permissao ) )")
    .eq("id", userId)
    .maybeSingle();

  if (!data || !data.ativo) return null;

  const grupo = data.grupos_acesso as unknown as {
    id: string;
    nome: string;
    acesso_total: boolean;
    grupo_permissoes: { permissao: string }[];
  } | null;

  return {
    userId: data.id as string,
    nome: data.nome as string,
    email: data.email as string,
    grupoId: grupo?.id ?? null,
    grupoNome: grupo?.nome ?? null,
    acessoTotal: grupo?.acesso_total ?? false,
    permissoes: grupo?.grupo_permissoes.map((p) => p.permissao) ?? [],
  };
}
