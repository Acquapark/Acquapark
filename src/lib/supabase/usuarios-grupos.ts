import { SupabaseClient } from "@supabase/supabase-js";

export interface GrupoAcesso {
  id: string;
  nome: string;
  descricao: string;
  acessoTotal: boolean;
  permissoes: string[];
  totalUsuarios: number;
}

export interface UsuarioEquipe {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  grupoId: string | null;
  grupoNome: string | null;
  grupoAcessoTotal: boolean;
  criadoEm: string;
}

type Row = Record<string, unknown>;

export async function getGrupos(supabase: SupabaseClient): Promise<GrupoAcesso[]> {
  const { data, error } = await supabase
    .from("grupos_acesso")
    .select("id, nome, descricao, acesso_total, grupo_permissoes ( permissao ), usuarios ( count )")
    .order("acesso_total", { ascending: false })
    .order("nome");
  if (error) throw error;

  return (data as unknown as Row[]).map((row) => ({
    id: row.id as string,
    nome: row.nome as string,
    descricao: (row.descricao as string) ?? "",
    acessoTotal: row.acesso_total as boolean,
    permissoes: (row.grupo_permissoes as { permissao: string }[]).map((p) => p.permissao),
    totalUsuarios: (row.usuarios as { count: number }[])[0]?.count ?? 0,
  }));
}

export async function getUsuariosEquipe(supabase: SupabaseClient): Promise<UsuarioEquipe[]> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, ativo, grupo_id, created_at, grupos_acesso ( nome, acesso_total )")
    .order("nome");
  if (error) throw error;

  return (data as unknown as Row[]).map((row) => {
    const grupo = row.grupos_acesso as { nome: string; acesso_total: boolean } | null;
    return {
      id: row.id as string,
      nome: row.nome as string,
      email: row.email as string,
      ativo: row.ativo as boolean,
      grupoId: (row.grupo_id as string) ?? null,
      grupoNome: grupo?.nome ?? null,
      grupoAcessoTotal: grupo?.acesso_total ?? false,
      criadoEm: row.created_at as string,
    };
  });
}
