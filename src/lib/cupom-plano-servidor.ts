import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeBR } from "@/lib/datas-br";
import type { CupomPlano } from "@/lib/cupom-plano";

type Row = Record<string, unknown>;

function mapCupomPlano(row: Row): CupomPlano {
  return {
    id: row.id as string,
    codigo: row.codigo as string,
    tipoDesconto: row.tipo_desconto as CupomPlano["tipoDesconto"],
    valor: Number(row.valor),
    mesesDesconto: (row.meses_desconto as number) ?? null,
  };
}

/**
 * Confere se o cupom pode ser usado em plano, SEM consumir uso — para mostrar
 * o desconto na tela. O uso é consumido em `usarCupomPlano`, na criação do contrato.
 */
export async function conferirCupomPlano(
  supabase: SupabaseClient,
  codigo: string,
): Promise<{ error: string } | { cupom: CupomPlano }> {
  const limpo = codigo.trim();
  if (!limpo) return { error: "Informe o código do cupom." };
  const { data, error } = await supabase
    .from("cupons_desconto")
    .select("id, codigo, tipo_desconto, valor, ativo, validade, limite_usos, usos, aplica_a, meses_desconto")
    .ilike("codigo", limpo)
    .maybeSingle();
  if (error) {
    console.error("Falha ao conferir cupom de plano:", error.message);
    return { error: "Não foi possível conferir o cupom agora. Tente novamente." };
  }
  // Cupom só de ingresso: para plano, ele "não existe".
  if (!data || !data.ativo || !["planos", "ambos"].includes(data.aplica_a as string)) return { error: "Cupom inválido." };
  if (data.validade && (data.validade as string) < hojeBR()) return { error: "Este cupom expirou." };
  if (data.limite_usos !== null && (data.usos as number) >= (data.limite_usos as number)) {
    return { error: "Este cupom atingiu o limite de usos." };
  }
  return { cupom: mapCupomPlano(data as Row) };
}

/** Consome 1 uso do cupom (atômico, no banco) e devolve as regras dele. */
export async function usarCupomPlano(
  supabase: SupabaseClient,
  codigo: string,
): Promise<{ error: string } | { cupom: CupomPlano }> {
  const { data, error } = await supabase.rpc("usar_cupom_plano", { p_codigo: codigo.trim() });
  if (error || !data) return { error: error?.message ?? "Cupom inválido." };
  return { cupom: mapCupomPlano(data as Row) };
}

/** Devolve o uso consumido quando o cadastro falha depois de usar o cupom. */
export async function devolverCupomPlano(supabase: SupabaseClient, cupomId: string) {
  const { error } = await supabase.rpc("devolver_cupom_plano", { p_cupom_id: cupomId });
  if (error) console.error("Falha ao devolver uso do cupom de plano:", error.message);
}
