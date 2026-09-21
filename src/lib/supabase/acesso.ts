import { SupabaseClient } from "@supabase/supabase-js";
import { AcessoAssociado } from "@/types";

type Row = Record<string, unknown>;

export async function getAcessoAssociado(supabase: SupabaseClient, associadoId: string): Promise<AcessoAssociado | null> {
  const { data, error } = await supabase
    .from("associado_acessos")
    .select("*")
    .eq("associado_id", associadoId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Row;
  return {
    id: row.id as string,
    associadoId: row.associado_id as string,
    email: row.email as string,
    status: row.status as AcessoAssociado["status"],
    ultimoAcesso: (row.ultimo_acesso as string) ?? null,
  };
}
