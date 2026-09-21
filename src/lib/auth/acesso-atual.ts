import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { carregarAcesso } from "@/lib/acesso";
import { AcessoUsuario, temAlgumaPermissao } from "@/lib/permissoes";

/**
 * Acesso do usuário logado, memoizado por requisição (layout, página e Server
 * Actions da mesma requisição só consultam o banco uma vez).
 * Usa getClaims: valida o JWT localmente, sem ir ao Supabase Auth.
 */
export const getAcessoAtual = cache(async (): Promise<AcessoUsuario | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims?.sub as string | undefined) ?? null;
  if (!userId) return null;
  return carregarAcesso(supabase, userId);
});

/**
 * Guarda das Server Actions: devolve null se o usuário tem QUALQUER uma das
 * permissões, ou o objeto `{ error }` que a action deve retornar. A interface
 * esconde os botões, mas é isto que realmente barra a chamada.
 */
export async function exigirPermissao(...chaves: string[]): Promise<{ error: string } | null> {
  const acesso = await getAcessoAtual();
  if (!acesso) return { error: "Sessão expirada ou usuário sem acesso. Entre novamente." };
  if (!temAlgumaPermissao(acesso, chaves)) return { error: "Você não tem permissão para realizar esta ação." };
  return null;
}
