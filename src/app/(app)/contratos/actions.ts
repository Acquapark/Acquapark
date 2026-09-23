"use server";

import { revalidatePath } from "next/cache";
import mammoth from "mammoth";
import { createClient } from "@/lib/supabase/server";
import { getAssociadoById, getPlanos, getPlanosTodos } from "@/lib/supabase/associados";
import { getEmpresa, getModeloById, getContratoGeradoById } from "@/lib/supabase/contratos";
import { calcularDatasContrato, findMissingVariables } from "@/lib/contracts/variables";
import { gerarContratoParaAssociado } from "@/lib/contracts/gerar";
import { criarDocumentoParaAssinatura } from "@/lib/signature/autentique";
import { exigirPermissao } from "@/lib/auth/acesso-atual";

export async function createModelo(formData: FormData) {
  const negado = await exigirPermissao("modelos_contrato.criar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();

  const nome = String(formData.get("nome") ?? "");
  const descricao = String(formData.get("descricao") ?? "");
  const tipo = String(formData.get("tipo") ?? "Associação");
  const status = String(formData.get("status") ?? "Ativo");
  const file = formData.get("arquivo") as File | null;

  let conteudoHtml = "<p>Comece a editar o modelo do contrato aqui...</p>";
  let arquivoNome: string | null = null;
  let arquivoPath: string | null = null;

  if (file && file.size > 0) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      const result = await mammoth.convertToHtml({ buffer });
      conteudoHtml = result.value || conteudoHtml;
    } catch (err) {
      return { error: `Não foi possível ler o arquivo .docx: ${(err as Error).message}` };
    }

    const path = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("contratos-modelos").upload(path, buffer, {
      contentType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    if (!uploadError) {
      arquivoNome = file.name;
      arquivoPath = path;
    }
  }

  const { data, error } = await supabase
    .from("modelos_contrato")
    .insert({
      nome,
      descricao,
      tipo,
      status,
      conteudo_html: conteudoHtml,
      arquivo_original_nome: arquivoNome,
      arquivo_original_path: arquivoPath,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Não foi possível criar o modelo." };
  }

  revalidatePath("/contratos");
  return { modeloId: data.id as string };
}

export async function updateModeloConteudo(id: string, conteudoHtml: string) {
  const negado = await exigirPermissao("modelos_contrato.editar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const modelo = await getModeloById(supabase, id);
  if (!modelo) return { error: "Modelo não encontrado." };

  const { error } = await supabase
    .from("modelos_contrato")
    .update({ conteudo_html: conteudoHtml, versao: modelo.versao + 1, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/contratos/modelos/${id}`);
  revalidatePath("/contratos");
  return { success: true, versao: modelo.versao + 1 };
}

export async function updateModeloDados(
  id: string,
  data: { nome: string; descricao: string; tipo: string; status: "Ativo" | "Inativo" },
) {
  const negado = await exigirPermissao("modelos_contrato.editar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("modelos_contrato")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contratos");
  revalidatePath(`/contratos/modelos/${id}`);
  return { success: true };
}

export async function toggleModeloStatus(id: string, status: "Ativo" | "Inativo") {
  const negado = await exigirPermissao("modelos_contrato.editar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase.from("modelos_contrato").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contratos");
  return { success: true };
}

export async function duplicateModelo(id: string) {
  const negado = await exigirPermissao("modelos_contrato.criar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const modelo = await getModeloById(supabase, id);
  if (!modelo) return { error: "Modelo não encontrado." };

  const { data, error } = await supabase
    .from("modelos_contrato")
    .insert({
      nome: `${modelo.nome} (cópia)`,
      descricao: modelo.descricao,
      tipo: modelo.tipo,
      status: "Inativo",
      conteudo_html: modelo.conteudoHtml,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Não foi possível duplicar o modelo." };
  revalidatePath("/contratos");
  return { modeloId: data.id as string };
}

export async function deleteModelo(id: string) {
  const negado = await exigirPermissao("modelos_contrato.excluir");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase.from("modelos_contrato").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contratos");
  return { success: true };
}

export async function saveEmpresa(data: {
  nome: string;
  razaoSocial: string;
  cnpj: string;
  telefone: string;
  email: string;
  endereco: string;
  numeroEndereco: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}) {
  const negado = await exigirPermissao("parque.editar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("empresa")
    .update({
      nome: data.nome,
      razao_social: data.razaoSocial,
      cnpj: data.cnpj,
      telefone: data.telefone,
      email: data.email,
      endereco: data.endereco,
      numero_endereco: data.numeroEndereco,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.cidade,
      estado: data.estado,
      cep: data.cep,
    })
    .eq("id", true);
  if (error) return { error: error.message };
  revalidatePath("/configuracoes");
  return { success: true };
}

export async function getPreviewData(associadoId: string) {
  const negado = await exigirPermissao("contratos_gerados.criar", "modelos_contrato.visualizar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const [result, empresa, planos] = await Promise.all([
    getAssociadoById(supabase, associadoId),
    getEmpresa(supabase),
    getPlanos(supabase),
  ]);
  if (!result) return { error: "Associado não encontrado." };
  const plano = result.planoId ? (planos.find((p) => p.id === result.planoId) ?? null) : null;
  return { associado: result.associado, plano, empresa };
}

export async function checkContratoMissingVariables(associadoId: string, modeloId: string) {
  const negado = await exigirPermissao("contratos_gerados.criar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const [result, modelo, empresa, planos] = await Promise.all([
    getAssociadoById(supabase, associadoId),
    getModeloById(supabase, modeloId),
    getEmpresa(supabase),
    getPlanosTodos(supabase),
  ]);

  if (!result || !modelo) return { error: "Associado ou modelo não encontrado." };

  const plano = result.planoId ? (planos.find((p) => p.id === result.planoId) ?? null) : null;
  const dataHoje = new Date().toISOString().slice(0, 10);
  const { dataInicio, dataFim, diaVencimento } = calcularDatasContrato(result.associado.mensalidades);
  const missing = findMissingVariables(modelo.conteudoHtml, {
    associado: result.associado,
    plano,
    empresa,
    contrato: { numero: "", data: dataHoje, dataInicio, dataFim, diaVencimento },
  });

  return { missing: missing.map((m) => ({ key: m.key, label: m.label, group: m.group })) };
}

export async function gerarContrato(params: {
  associadoId: string;
  modeloId: string;
  dataContrato: string;
}): Promise<
  | { error: string; missing?: { key: string; label: string; group: string }[] }
  | { contratoId: string; numero: string }
> {
  const negado = await exigirPermissao("contratos_gerados.criar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await gerarContratoParaAssociado(supabase, { ...params, geradoPor: user?.id ?? null });
  if ("error" in result) return result;

  revalidatePath(`/associados/${params.associadoId}`);
  return { contratoId: result.contratoId, numero: result.numero };
}

export async function setModeloPadrao(id: string) {
  const negado = await exigirPermissao("modelos_contrato.editar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();

  await supabase.from("modelos_contrato").update({ padrao: false }).eq("padrao", true);
  const { error } = await supabase.from("modelos_contrato").update({ padrao: true }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/contratos");
  return { success: true };
}

export async function enviarParaAssinatura(contratoId: string) {
  const negado = await exigirPermissao("contratos_gerados.criar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();

  const contrato = await getContratoGeradoById(supabase, contratoId);
  if (!contrato) return { error: "Contrato não encontrado." };

  const result = await getAssociadoById(supabase, contrato.associadoId);
  if (!result) return { error: "Associado não encontrado." };
  if (!result.associado.email) return { error: "Este associado não tem e-mail cadastrado." };

  try {
    const { documentoId } = await criarDocumentoParaAssinatura({
      nomeDocumento: `Contrato ${contrato.numero} - ${result.associado.nome}`,
      conteudoHtml: contrato.conteudoHtml,
      signerNome: result.associado.nome,
      signerEmail: result.associado.email,
    });

    const { error } = await supabase
      .from("contratos_gerados")
      .update({ status: "Enviado para assinatura", enviado_em: new Date().toISOString(), autentique_document_id: documentoId })
      .eq("id", contratoId);
    if (error) return { error: error.message };
  } catch (err) {
    return { error: (err as Error).message };
  }

  revalidatePath(`/associados/${contrato.associadoId}`);
  return { success: true };
}
