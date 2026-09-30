"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apagarLogins, loginsDoAssociado } from "@/lib/associados/acesso-portal";
import { AssociadoFormState } from "@/components/associados/form-types";
import { AssociadoStatus } from "@/types";
import { exigirPermissao } from "@/lib/auth/acesso-atual";
import {
  BUCKET_FOTOS,
  camposExigidosPeloContrato,
  criarAcessoAutomatico,
  criarContratoEMensalidades,
  gerarEEnviarContratoAutomatico,
  enviarFoto,
  validarFoto,
  validarPrimeiraParcela,
} from "@/lib/associados/cadastro";
import { ativarAssociadoSeParcela1Paga } from "@/lib/supabase/associados";
import { paymentGateway } from "@/lib/gateway";

export async function createAssociado(form: AssociadoFormState) {
  const negado = await exigirPermissao("associados.criar");
  if (negado) return { error: negado.error };
  if (!form.email) return { error: "Informe o e-mail do associado — é para onde vai o contrato para assinatura." };
  // O cadastro pode já vincular um plano (gera contrato e mensalidades): isso tem permissão própria.
  if (form.planoId) {
    const semPlano = await exigirPermissao("planos_associado.criar");
    if (semPlano) return { error: "Você não tem permissão para vincular plano. Cadastre o associado sem plano." };
  }
  const supabase = await createClient();

  if (form.planoId && form.dataInicio) {
    const validacao = await validarPrimeiraParcela(supabase, form.planoId, form.dataInicio, form.primeiraParcelaData);
    if (validacao.error) return { error: validacao.error };
  }

  // O contrato automático usa dados do cadastro: sem eles ele não é gerado.
  // Melhor avisar agora, com o formulário aberto, do que falhar depois.
  const faltandoParaContrato = (await camposExigidosPeloContrato(supabase)).filter((v) => !String(form[v.campo] ?? "").trim());
  if (faltandoParaContrato.length > 0) {
    return { error: `Preencha os dados usados no contrato: ${faltandoParaContrato.map((v) => v.label).join(", ")}.` };
  }

  const { data: associado, error: associadoError } = await supabase
    .from("associados")
    .insert({
      nome: form.nome,
      cpf: form.cpf,
      rg: form.rg || null,
      nascimento: form.nascimento || null,
      sexo: form.sexo || null,
      telefone: form.telefone || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      cep: form.cep || null,
      endereco: form.endereco || null,
      numero_endereco: form.numero || null,
      complemento: form.complemento || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      observacoes: form.observacoes || null,
      plano_id: form.planoId || null,
      // Com plano vinculado, o associado só vira "Ativo" quando a 1ª parcela
      // for paga (ver `ativarAssociadoSeParcela1Paga`) — sem plano não há
      // parcela a esperar, então já entra "Ativo".
      status: form.planoId && form.dataInicio ? "Pendente" : "Ativo",
    })
    .select("id, numero")
    .single();

  if (associadoError || !associado) {
    return { error: associadoError?.message ?? "Não foi possível criar o associado." };
  }

  if (form.dependentes.length > 0) {
    const { error: dependentesError } = await supabase.from("dependentes").insert(
      form.dependentes.map((d) => ({
        associado_id: associado.id,
        nome: d.nome,
        cpf: d.cpf || null,
        parentesco: d.parentesco,
        nascimento: d.nascimento || null,
      })),
    );
    if (dependentesError) {
      return { error: dependentesError.message, associadoId: associado.id as string };
    }
  }

  if (form.planoId && form.dataInicio) {
    const valorOverride = form.valorMensalidade ? Number(form.valorMensalidade.replace(",", ".")) : undefined;
    const descontoPercentual = Number(form.desconto.replace(",", ".")) || 0;
    const contratoResult = await criarContratoEMensalidades(supabase, {
      associadoId: associado.id,
      planoId: form.planoId,
      dataInicio: form.dataInicio,
      valorOverride,
      descontoPercentual,
      primeiraParcelaManual: form.primeiraParcelaData || undefined,
    });
    if (contratoResult.error) {
      return { error: contratoResult.error, associadoId: associado.id as string };
    }
  }

  const { data: credencial } = await supabase
    .from("credenciais")
    .insert({ associado_id: associado.id })
    .select("codigo")
    .single();

  await criarAcessoAutomatico(associado.id as string, form.email, form.cpf.replace(/\D/g, ""));

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const avisoContrato = await gerarEEnviarContratoAutomatico(supabase, {
    associadoId: associado.id as string,
    associadoNome: form.nome,
    associadoEmail: form.email,
    dataContrato: new Date().toISOString().slice(0, 10),
    geradoPor: user?.id ?? null,
  });

  revalidatePath(`/associados/${associado.id}`);
  revalidatePath("/associados");
  return {
    associadoId: associado.id as string,
    numero: associado.numero as string,
    credencialCodigo: (credencial?.codigo as string) ?? undefined,
    avisoContrato: avisoContrato ?? undefined,
  };
}

export async function deleteAssociado(id: string) {
  const negado = await exigirPermissao("associados.excluir");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const admin = createAdminClient();
  const logins = await loginsDoAssociado(admin, id);
  const { error } = await supabase.from("associados").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { error: "Este associado tem histórico vinculado e não pode ser excluído. Inative-o em vez de excluir." };
    }
    return { error: error.message };
  }
  // O login do Portal não sai junto com o associado — sem isto ele ficava
  // órfão e impedia um novo cadastro com o mesmo e-mail.
  await apagarLogins(admin, logins);
  revalidatePath("/associados");
  return { success: true };
}

export async function updateAssociado(id: string, form: AssociadoFormState) {
  const negado = await exigirPermissao("associados.editar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();

  const { error } = await supabase
    .from("associados")
    .update({
      nome: form.nome,
      cpf: form.cpf,
      rg: form.rg || null,
      nascimento: form.nascimento || null,
      sexo: form.sexo || null,
      telefone: form.telefone || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      cep: form.cep || null,
      endereco: form.endereco || null,
      numero_endereco: form.numero || null,
      complemento: form.complemento || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      observacoes: form.observacoes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/associados/${id}`);
  revalidatePath("/associados");
  return { success: true };
}

export async function addDependente(
  associadoId: string,
  dependente: { nome: string; cpf?: string; rg?: string; nascimento?: string; parentesco: string; sexo?: string },
) {
  const negado = await exigirPermissao("dependentes.criar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();

  const { error } = await supabase.from("dependentes").insert({
    associado_id: associadoId,
    nome: dependente.nome,
    cpf: dependente.cpf || null,
    rg: dependente.rg || null,
    nascimento: dependente.nascimento || null,
    parentesco: dependente.parentesco,
    sexo: dependente.sexo || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/associados/${associadoId}`);
  return { success: true };
}

export async function removeDependente(dependenteId: string, associadoId: string) {
  const negado = await exigirPermissao("dependentes.excluir");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase.from("dependentes").delete().eq("id", dependenteId);
  if (error) return { error: error.message };

  revalidatePath(`/associados/${associadoId}`);
  return { success: true };
}

const MENSALIDADE_CANCELAVEL = new Set(["Pendente", "Vencido", "Em processamento"]);

/**
 * Cancela o contrato ativo e todas as mensalidades ainda em aberto do
 * associado — inclui cancelar a cobrança correspondente na Asaas antes de
 * marcar cada mensalidade como "Cancelado" (nunca deleta, fica no histórico).
 * Chamada ao inativar um associado ("encerramento definitivo"): sem isso, a
 * Asaas continua tentando cobrar mensalidades de alguém que já saiu — o
 * mesmo perigo de excluir o cliente direto na Asaas sem cancelar as
 * cobranças, só que pelo caminho contrário.
 *
 * Nunca lança: cada mensalidade é tentada independentemente, e as que
 * falharem (ex: Asaas fora do ar) ficam registradas em `falhas` pra quem
 * chamou avisar a equipe — o inativar em si não deve travar por causa disso.
 */
async function cancelarContratoEParcelasDoAssociado(
  supabase: SupabaseClient,
  associadoId: string,
): Promise<{ parcelasCanceladas: number; falhas: string[] }> {
  const { data: mensalidades } = await supabase
    .from("mensalidades")
    .select("id, numero_parcela, gateway_charge_id")
    .eq("associado_id", associadoId)
    .in("status", Array.from(MENSALIDADE_CANCELAVEL));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let parcelasCanceladas = 0;
  const falhas: string[] = [];

  for (const m of mensalidades ?? []) {
    const chargeId = m.gateway_charge_id as string | null;
    try {
      if (chargeId) await paymentGateway.cancelarCobranca(chargeId);
      const { error } = await supabase
        .from("mensalidades")
        .update({
          status: "Cancelado",
          cancelado_em: new Date().toISOString(),
          cancelado_por: user?.id ?? null,
          ...(chargeId ? { asaas_status: "DELETED", asaas_last_sync_at: new Date().toISOString() } : {}),
        })
        .eq("id", m.id);
      if (error) throw new Error(error.message);
      parcelasCanceladas++;
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "Erro desconhecido";
      falhas.push(`Parcela ${m.numero_parcela ?? "—"}: ${motivo}`);
    }
  }

  await supabase.from("contratos").update({ status: "Cancelado" }).eq("associado_id", associadoId).eq("status", "Ativo");

  return { parcelasCanceladas, falhas };
}

export async function updateAssociadoStatus(
  id: string,
  status: AssociadoStatus,
): Promise<{ error: string } | { success: true; parcelasCanceladas?: number; falhasCancelamento?: string[] }> {
  const negado = await exigirPermissao("associados.alterar_status");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase.from("associados").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  let parcelasCanceladas: number | undefined;
  let falhasCancelamento: string[] | undefined;
  if (status === "Inativo") {
    const resultado = await cancelarContratoEParcelasDoAssociado(supabase, id);
    parcelasCanceladas = resultado.parcelasCanceladas;
    if (resultado.falhas.length > 0) falhasCancelamento = resultado.falhas;
  }

  revalidatePath(`/associados/${id}`);
  revalidatePath("/associados");
  return { success: true, parcelasCanceladas, falhasCancelamento };
}

export async function ensureCredencial(associadoId: string) {
  // Roda sozinha ao abrir a aba Credencial: quem só visualiza recebe a existente, mas não cria uma nova.
  const negado = await exigirPermissao("credenciais.visualizar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("credenciais")
    .select("codigo")
    .eq("associado_id", associadoId)
    .eq("ativa", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return { codigo: existing.codigo as string };

  const semCriar = await exigirPermissao("credenciais.criar");
  if (semCriar) return { error: "Este associado ainda não tem credencial e você não pode gerá-la." };

  const { data, error } = await supabase
    .from("credenciais")
    .insert({ associado_id: associadoId })
    .select("codigo")
    .single();

  if (error || !data) return { error: error?.message ?? "Não foi possível gerar a credencial." };

  revalidatePath(`/associados/${associadoId}`);
  return { codigo: data.codigo as string };
}

export async function regenerarCredencial(associadoId: string) {
  const negado = await exigirPermissao("credenciais.editar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();

  await supabase.from("credenciais").update({ ativa: false }).eq("associado_id", associadoId).eq("ativa", true);

  const { data, error } = await supabase
    .from("credenciais")
    .insert({ associado_id: associadoId })
    .select("codigo")
    .single();

  if (error || !data) return { error: error?.message ?? "Não foi possível regenerar a credencial." };

  revalidatePath(`/associados/${associadoId}`);
  return { codigo: data.codigo as string };
}

export async function vincularPlano(
  associadoId: string,
  planoId: string,
  dataInicio: string,
  valorOverride?: number,
  primeiraParcelaManual?: string,
) {
  const negado = await exigirPermissao("planos_associado.criar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("contratos")
    .select("id")
    .eq("associado_id", associadoId)
    .eq("status", "Ativo")
    .maybeSingle();

  if (existente) {
    return { error: "Este associado já possui um contrato ativo. Renovação/troca de plano ainda não está disponível." };
  }

  const result = await criarContratoEMensalidades(supabase, {
    associadoId,
    planoId,
    dataInicio,
    valorOverride,
    primeiraParcelaManual,
  });
  if (result.error) return { error: result.error };

  await supabase.from("associados").update({ plano_id: planoId }).eq("id", associadoId);

  revalidatePath(`/associados/${associadoId}`);
  revalidatePath("/associados");
  return { contratoId: result.contratoId, numero: result.numero };
}

export async function registrarPagamento(
  mensalidadeId: string,
  associadoId: string,
  params: { formaPagamento: string; valor: number },
) {
  const negado = await exigirPermissao("contas_receber.receber");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: pagamentoError } = await supabase.from("pagamentos").insert({
    mensalidade_id: mensalidadeId,
    valor: params.valor,
    forma_pagamento: params.formaPagamento,
    usuario_id: user?.id ?? null,
  });
  if (pagamentoError) return { error: pagamentoError.message };

  const { data: mensalidade, error: mensalidadeError } = await supabase
    .from("mensalidades")
    .update({ status: "Pago", forma_pagamento: params.formaPagamento, pago_em: new Date().toISOString() })
    .eq("id", mensalidadeId)
    .select("numero_parcela")
    .single();
  if (mensalidadeError) return { error: mensalidadeError.message };

  await ativarAssociadoSeParcela1Paga(supabase, associadoId, mensalidade?.numero_parcela as number | null);

  revalidatePath(`/associados/${associadoId}`);
  revalidatePath("/financeiro");
  return { success: true };
}

/**
 * Envia ou troca a foto do associado (cadastro e edição pelo painel). A foto
 * antiga é apagada do bucket depois que a nova já está gravada.
 */
export async function salvarFotoAssociado(associadoId: string, formData: FormData) {
  // "criar" também vale: o cadastro envia a foto logo depois de criar o associado.
  const negado = await exigirPermissao("associados.editar", "associados.criar");
  if (negado) return { error: negado.error };

  const foto = validarFoto(formData.get("foto"));
  if ("error" in foto) return foto;

  const supabase = await createClient();
  const { data: associado } = await supabase.from("associados").select("foto_url").eq("id", associadoId).maybeSingle();
  if (!associado) return { error: "Associado não encontrado." };

  const enviada = await enviarFoto(supabase, foto);
  if ("error" in enviada) return enviada;

  const { error } = await supabase.from("associados").update({ foto_url: enviada.caminho }).eq("id", associadoId);
  if (error) {
    await supabase.storage.from(BUCKET_FOTOS).remove([enviada.caminho]);
    return { error: error.message };
  }
  if (associado.foto_url) await supabase.storage.from(BUCKET_FOTOS).remove([associado.foto_url as string]);

  revalidatePath(`/associados/${associadoId}`);
  return { success: true };
}
