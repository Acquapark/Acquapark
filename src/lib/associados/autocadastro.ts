import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PlanoAutocadastro } from "./autocadastro-tipos";

type Row = Record<string, unknown>;

/**
 * Planos que aparecem no autocadastro: ativos, marcados como disponíveis e que
 * não exigem a data da 1ª parcela escolhida pela equipe (regra "manual") —
 * essa escolha não cabe na página pública.
 */
export async function getPlanosAutocadastro(admin: SupabaseClient): Promise<PlanoAutocadastro[]> {
  const { data, error } = await admin
    .from("planos")
    .select(
      "id, nome, valor, dependentes_permitidos, beneficios, quantidade_mensalidades, dia_vencimento, regra_primeira_parcela, vencimento_na_contratacao",
    )
    .eq("ativo", true)
    .eq("disponivel_autocadastro", true)
    .order("valor");
  if (error) throw error;

  return ((data ?? []) as Row[])
    .filter((row) => row.vencimento_na_contratacao || row.regra_primeira_parcela !== "manual")
    .map((row) => ({
      id: row.id as string,
      nome: row.nome as string,
      valor: Number(row.valor),
      dependentesPermitidos: (row.dependentes_permitidos as number) ?? 0,
      beneficios: (row.beneficios as string[]) ?? [],
      quantidadeMensalidades: (row.quantidade_mensalidades as number) ?? 12,
      diaVencimento: (row.dia_vencimento as number) ?? 10,
      vencimentoNaContratacao: Boolean(row.vencimento_na_contratacao),
    }));
}
