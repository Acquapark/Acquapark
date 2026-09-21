"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { exigirPermissao } from "@/lib/auth/acesso-atual";

export interface ValidacaoResultado {
  autorizado: boolean;
  titulo: string;
  detalhe: string;
  motivo?: string;
}

type Resultado = "Autorizado" | "Negado" | "Bloqueado";

function hojeBR() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function formatarDataBR(iso: string) {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

async function jaEntrouHoje(supabase: SupabaseClient, coluna: "ingresso_id" | "credencial_id", id: string) {
  const inicioDoDia = `${hojeBR()}T00:00:00-03:00`;
  const { count } = await supabase
    .from("acessos")
    .select("id", { count: "exact", head: true })
    .eq(coluna, id)
    .eq("resultado", "Autorizado")
    .gte("registrado_em", inicioDoDia);
  return (count ?? 0) > 0;
}

async function registrarAcesso(
  supabase: SupabaseClient,
  origem: { ingresso_id?: string; credencial_id?: string },
  tipo: "Entrada" | "Reentrada",
  resultado: Resultado,
  motivo?: string,
) {
  await supabase.from("acessos").insert({ ...origem, tipo, resultado, motivo: motivo ?? null });
}

async function validarIngresso(
  supabase: SupabaseClient,
  ingresso: Record<string, unknown>,
): Promise<ValidacaoResultado> {
  const id = ingresso.id as string;
  const numero = ingresso.numero as string;
  const tipoNome = ((ingresso.tipos_ingresso as Record<string, unknown> | null)?.nome as string) ?? "Ingresso";
  const comprador = (ingresso.comprador_nome as string) ?? "";
  const dataUtilizacao = ingresso.data_utilizacao as string;
  const status = ingresso.status as string;
  const regra = ingresso.regra_reentrada as string;
  const hoje = hojeBR();
  const titulo = `Ingresso ${numero}`;
  const detalhe = [tipoNome, comprador].filter(Boolean).join(" — ");

  const negar = async (motivo: string): Promise<ValidacaoResultado> => {
    await registrarAcesso(supabase, { ingresso_id: id }, "Entrada", "Negado", motivo);
    return { autorizado: false, titulo, detalhe, motivo };
  };

  if (status === "Cancelado") return negar("Ingresso cancelado.");
  if (status === "Expirado") return negar("Ingresso expirado.");
  if (status === "Utilizado") return negar("Ingresso já utilizado.");

  if (dataUtilizacao < hoje) {
    await supabase.from("ingressos").update({ status: "Expirado" }).eq("id", id).eq("status", "Disponível");
    return negar(`Ingresso expirado (era válido em ${formatarDataBR(dataUtilizacao)}).`);
  }
  if (dataUtilizacao > hoje) return negar(`Ingresso válido apenas em ${formatarDataBR(dataUtilizacao)}.`);

  if (regra === "unica") {
    // Update condicional: se dois leitores lerem ao mesmo tempo, só um consegue consumir o ingresso.
    const { data: consumido } = await supabase
      .from("ingressos")
      .update({ status: "Utilizado", utilizado_em: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "Disponível")
      .select("id");
    if (!consumido || consumido.length === 0) return negar("Ingresso já utilizado.");
    await registrarAcesso(supabase, { ingresso_id: id }, "Entrada", "Autorizado");
  } else {
    const reentrada = await jaEntrouHoje(supabase, "ingresso_id", id);
    await registrarAcesso(supabase, { ingresso_id: id }, reentrada ? "Reentrada" : "Entrada", "Autorizado");
  }

  return { autorizado: true, titulo, detalhe };
}

async function validarCredencial(
  supabase: SupabaseClient,
  credencial: Record<string, unknown>,
): Promise<ValidacaoResultado> {
  const id = credencial.id as string;
  const associado = credencial.associados as Record<string, unknown> | null;
  const nome = (associado?.nome as string) ?? "Associado";
  const status = (associado?.status as string) ?? "Inativo";
  const planoNome = ((associado?.planos as Record<string, unknown> | null)?.nome as string) ?? "";
  const titulo = nome;
  const detalhe = `Associado${planoNome ? ` — Plano ${planoNome}` : ""}`;

  const negar = async (motivo: string, resultado: Resultado = "Negado"): Promise<ValidacaoResultado> => {
    await registrarAcesso(supabase, { credencial_id: id }, "Entrada", resultado, motivo);
    return { autorizado: false, titulo, detalhe, motivo };
  };

  if (!credencial.ativa) return negar("Credencial desativada.");
  if (status === "Suspenso") return negar("Associado bloqueado.", "Bloqueado");
  if (status === "Inativo") return negar("Associado inativo.", "Bloqueado");
  if (status === "Inadimplente") return negar("Associação inadimplente.");
  if (status === "Pendente") return negar("Associação pendente de ativação.");

  const jaEntrou = await jaEntrouHoje(supabase, "credencial_id", id);
  if (jaEntrou && credencial.regra_reentrada === "unica") return negar("Credencial já utilizada hoje.");

  await registrarAcesso(supabase, { credencial_id: id }, jaEntrou ? "Reentrada" : "Entrada", "Autorizado");
  return { autorizado: true, titulo, detalhe };
}

export async function validarCodigo(codigoBruto: string): Promise<ValidacaoResultado> {
  const negado = await exigirPermissao("controle_acesso.validar");
  if (negado) return { autorizado: false, titulo: "Sem permissão", detalhe: "", motivo: negado.error };

  const codigo = codigoBruto.trim();
  if (!codigo) {
    return { autorizado: false, titulo: "Código vazio", detalhe: "", motivo: "Leia ou digite o código do QR Code." };
  }

  const supabase = await createClient();

  const { data: ingresso } = await supabase
    .from("ingressos")
    .select("id, numero, comprador_nome, data_utilizacao, status, regra_reentrada, tipos_ingresso ( nome )")
    .eq("codigo", codigo)
    .maybeSingle();

  let resultado: ValidacaoResultado;
  if (ingresso) {
    resultado = await validarIngresso(supabase, ingresso as unknown as Record<string, unknown>);
  } else {
    const { data: credencial } = await supabase
      .from("credenciais")
      .select("id, ativa, regra_reentrada, associados ( nome, status, planos ( nome ) )")
      .eq("codigo", codigo)
      .maybeSingle();

    resultado = credencial
      ? await validarCredencial(supabase, credencial as unknown as Record<string, unknown>)
      : { autorizado: false, titulo: "Código não reconhecido", detalhe: "", motivo: "Ingresso ou credencial não encontrado." };
  }

  revalidatePath("/controle-acesso");
  return resultado;
}
