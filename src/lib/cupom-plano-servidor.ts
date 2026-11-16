import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeBR } from "@/lib/datas-br";
import type { CupomPlano } from "@/lib/cupom-plano";

type Row = Record<string, unknown>;

/** Colunas que `cupomPlanoDaLinha` precisa — use no select (ou no join) do cupom. */
export const COLUNAS_CUPOM_PLANO = "id, codigo, tipo_desconto, valor, ativo, validade, limite_usos, usos, aplica_a, meses_desconto";

function mapCupomPlano(row: Row): CupomPlano {
  return {
    id: row.id as string,
    codigo: row.codigo as string,
    tipoDesconto: row.tipo_desconto as CupomPlano["tipoDesconto"],
    valor: Number(row.valor),
    mesesDesconto: (row.meses_desconto as number) ?? null,
  };
}

/** Por que o cupom não pode ser usado em plano agora (null = pode). */
function motivoCupomPlanoInvalido(row: Row | null | undefined): string | null {
  // Cupom só de ingresso: para plano, ele "não existe".
  if (!row || !row.ativo || !["planos", "ambos"].includes(row.aplica_a as string)) return "Cupom inválido.";
  if (row.validade && (row.validade as string) < hojeBR()) return "Este cupom expirou.";
  if (row.limite_usos !== null && (row.usos as number) >= (row.limite_usos as number)) {
    return "Este cupom atingiu o limite de usos.";
  }
  return null;
}

/**
 * Cupom de plano de uma linha já carregada (ex.: o cupom da empresa parceira,
 * vindo de um join com COLUNAS_CUPOM_PLANO). Null se não puder ser usado agora.
 */
export function cupomPlanoDaLinha(row: Row | null | undefined): CupomPlano | null {
  return row && !motivoCupomPlanoInvalido(row) ? mapCupomPlano(row) : null;
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
    .select(COLUNAS_CUPOM_PLANO)
    .ilike("codigo", limpo)
    .maybeSingle();
  if (error) {
    console.error("Falha ao conferir cupom de plano:", error.message);
    return { error: "Não foi possível conferir o cupom agora. Tente novamente." };
  }
  const invalido = motivoCupomPlanoInvalido(data as Row | null);
  if (invalido) return { error: invalido };
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
