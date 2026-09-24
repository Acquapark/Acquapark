"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirPermissao } from "@/lib/auth/acesso-atual";
import { validarPorCodigo, type ValidacaoResultado } from "@/lib/controle-acesso/validar";

export async function validarCodigo(codigoBruto: string): Promise<ValidacaoResultado> {
  const negado = await exigirPermissao("controle_acesso.validar");
  if (negado) return { autorizado: false, titulo: "Sem permissão", detalhe: "", motivo: negado.error };

  const supabase = await createClient();
  const resultado = await validarPorCodigo(supabase, codigoBruto);

  revalidatePath("/controle-acesso");
  return resultado;
}
