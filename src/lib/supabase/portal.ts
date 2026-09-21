import { SupabaseClient } from "@supabase/supabase-js";

export interface PortalContext {
  userId: string;
  associadoId: string;
  email: string;
}

/**
 * Resolve a sessão do portal a partir dos cookies — nunca aceitar um
 * associadoId vindo do cliente. Toda página/ação do portal deve chamar isto
 * primeiro e usar o `associadoId` retornado para filtrar os dados.
 */
export async function getPortalContext(supabase: SupabaseClient): Promise<PortalContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: acesso } = await supabase
    .from("associado_acessos")
    .select("associado_id, email, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!acesso || acesso.status !== "Ativo") return null;

  return { userId: user.id, associadoId: acesso.associado_id as string, email: acesso.email as string };
}
