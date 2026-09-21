"use server";

import { createClient } from "@/lib/supabase/server";
import { exigirPermissao } from "@/lib/auth/acesso-atual";
import { permissaoDoRelatorio } from "@/lib/permissoes";
import { gerarRelatorio } from "@/lib/supabase/relatorios";
import { validarPeriodo } from "@/lib/relatorios/periodo";
import { Relatorio, relatorioIdValido } from "@/lib/relatorios/tipos";

export async function gerarRelatorioAction(
  id: string,
  de: string,
  ate: string,
): Promise<{ relatorio: Relatorio } | { error: string }> {
  if (!relatorioIdValido(id)) return { error: "Relatório desconhecido." };
  const negado = await exigirPermissao(permissaoDoRelatorio(id));
  if (negado) return { error: negado.error };
  const invalido = validarPeriodo(de, ate);
  if (invalido) return { error: invalido };

  try {
    const supabase = await createClient();
    return { relatorio: await gerarRelatorio(supabase, id, de, ate) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível gerar o relatório." };
  }
}
