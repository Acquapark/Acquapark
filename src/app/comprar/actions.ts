"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { gatewayReal, paymentGateway } from "@/lib/gateway";
import { hojeBR } from "@/lib/datas-br";
import { formatCPF, formatPhone, isCPFValido } from "@/lib/utils";
import {
  confirmarPedidoOnline,
  getConfigVendaOnline,
  getDatasAbertas,
  getPedidoPorToken,
  ingressosRestantes,
  janelaDeDatas,
  MINUTOS_PARA_PAGAR,
} from "@/lib/venda-online/servidor";

/** Pedidos por IP em 10 minutos — protege a página pública de abuso (cada pedido cria cobrança na Asaas). */
const LIMITE_PEDIDOS_POR_IP = 8;

async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
}

/** Situação de uma data: se dá para comprar e quantos ingressos online restam (null = sem limite). */
export async function consultarData(
  data: string,
): Promise<{ disponivel: false; motivo: string } | { disponivel: true; restantes: number | null }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { disponivel: false, motivo: "Data inválida." };
  const admin = createAdminClient();
  const config = await getConfigVendaOnline(admin);
  if (!config.ativa) return { disponivel: false, motivo: "A venda online está desativada no momento." };
  const janela = janelaDeDatas(config);
  if (data < janela.primeira) {
    return {
      disponivel: false,
      motivo: data === hojeBR() ? `A venda online para hoje encerrou às ${config.horaLimite}.` : "Escolha uma data a partir de hoje.",
    };
  }
  if (data > janela.ultima) return { disponivel: false, motivo: `A venda online vai até ${config.diasAntecedencia} dias à frente.` };
  if ((await getDatasAbertas(admin, data, data)).length === 0) {
    return { disponivel: false, motivo: "O parque não abre nesta data. Escolha um dos dias disponíveis no calendário." };
  }

  const restantes = await ingressosRestantes(admin, config, data);
  if (restantes === 0) return { disponivel: false, motivo: "Ingressos online esgotados para esta data." };
  return { disponivel: true, restantes };
}

/** Desconto do cupom em cada tipo — só para mostrar o total; o preço final é calculado de novo no banco. */
export async function conferirCupom(
  codigo: string,
  tipos: { id: string; valor: number }[],
): Promise<{ error: string } | { descontos: Record<string, number> }> {
  if (!codigo.trim()) return { error: "Informe o código do cupom." };
  const admin = createAdminClient();
  const { data } = await admin
    .from("cupons_desconto")
    .select("tipo_desconto, valor, ativo, validade, limite_usos, usos")
    .ilike("codigo", codigo.trim())
    .maybeSingle();
  if (!data || !data.ativo) return { error: "Cupom inválido." };
  if (data.validade && data.validade < hojeBR()) return { error: "Este cupom expirou." };
  if (data.limite_usos !== null && data.usos >= data.limite_usos) return { error: "Este cupom atingiu o limite de usos." };

  const descontos: Record<string, number> = {};
  for (const t of tipos) {
    descontos[t.id] =
      data.tipo_desconto === "percentual" ? Math.round(t.valor * Number(data.valor)) / 100 : Math.min(Number(data.valor), t.valor);
  }
  return { descontos };
}

export interface DadosPedido {
  data: string;
  itens: { tipoId: string; quantidade: number }[];
  cupom: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  forma: "Pix" | "Cartão de crédito";
  aceite: boolean;
  /** Campo-isca para robôs. */
  website?: string;
}

/**
 * Cria o pedido (reserva as vagas do dia por 30 min) e a cobrança na Asaas.
 * Preços, cupom e limite do dia são conferidos no banco (criar_pedido_online).
 */
export async function criarPedido(dados: DadosPedido): Promise<{ error: string } | { token: string }> {
  if (dados.website) return { error: "Não foi possível concluir a compra." };
  if (!dados.aceite) return { error: "É preciso concordar com as regras da compra." };
  if (dados.nome.trim().split(/\s+/).length < 2) return { error: "Informe o nome completo." };
  if (!isCPFValido(dados.cpf)) return { error: "CPF inválido." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())) return { error: "E-mail inválido." };
  if (dados.telefone.replace(/\D/g, "").length < 10) return { error: "Informe um telefone com DDD." };
  if (dados.forma !== "Pix" && dados.forma !== "Cartão de crédito") return { error: "Escolha a forma de pagamento." };
  const itens = (dados.itens ?? []).filter((i) => i.tipoId && Number.isInteger(i.quantidade) && i.quantidade > 0);
  if (itens.length === 0) return { error: "Escolha ao menos um ingresso." };

  const admin = createAdminClient();
  const ip = await ipDaRequisicao();
  const dezMinutosAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("pedidos_online")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("criado_em", dezMinutosAtras);
  if ((count ?? 0) >= LIMITE_PEDIDOS_POR_IP) return { error: "Muitas tentativas de compra. Aguarde alguns minutos e tente de novo." };

  const { data: pedido, error } = await admin.rpc("criar_pedido_online", {
    p_data: dados.data,
    p_itens: itens.map((i) => ({ tipo_id: i.tipoId, quantidade: i.quantidade })),
    p_cupom_codigo: dados.cupom.trim() || null,
    p_nome: dados.nome.trim(),
    p_cpf: formatCPF(dados.cpf),
    p_email: dados.email.trim(),
    p_telefone: formatPhone(dados.telefone),
    p_forma: dados.forma,
    p_ip: ip,
    p_minutos_expiracao: MINUTOS_PARA_PAGAR,
  });
  if (error || !pedido) {
    if (error?.code === "PGRST202") return { error: "A venda online ainda não foi ativada." };
    return { error: error?.message ?? "Não foi possível criar o pedido." };
  }
  const p = pedido as { id: string; numero: string; token: string; valor_total: number };

  // Cupom de 100%: nada a cobrar — emite na hora.
  if (Number(p.valor_total) <= 0) {
    const confirmacao = await confirmarPedidoOnline(p.id, "Cupom");
    if ("error" in confirmacao) return confirmacao;
    return { token: p.token };
  }

  try {
    const cobranca = await paymentGateway.criarCobrancaAvulsa({
      referencia: `pedido_online:${p.id}`,
      tipo: dados.forma === "Pix" ? "Pix" : "Cartão",
      valor: Number(p.valor_total),
      descricao: `Acqua Park — ingressos ${p.numero}`,
      comprador: { nome: dados.nome.trim(), cpf: dados.cpf, email: dados.email.trim(), telefone: dados.telefone },
    });
    await admin
      .from("pedidos_online")
      .update({ gateway_charge_id: cobranca.chargeId, pix_copia_e_cola: cobranca.copiaECola, checkout_url: cobranca.checkoutUrl })
      .eq("id", p.id);
  } catch (e) {
    // Sem cobrança o pedido não pode ser pago: cancela e libera as vagas.
    await admin.from("pedidos_online").update({ status: "Cancelado" }).eq("id", p.id);
    console.error(`[venda online] cobrança do pedido ${p.numero} não criada:`, e);
    return { error: "Não foi possível gerar o pagamento agora. Tente novamente em instantes." };
  }

  return { token: p.token };
}

/** Só no modo simulação (sem ASAAS_API_KEY): imita a confirmação da Asaas para testar o fluxo. */
export async function simularPagamentoPedido(token: string): Promise<{ error: string } | { success: true }> {
  if (gatewayReal) return { error: "Indisponível com o gateway real." };
  const admin = createAdminClient();
  const resultado = await getPedidoPorToken(admin, token);
  if (!resultado) return { error: "Pedido não encontrado." };
  return confirmarPedidoOnline(resultado.pedido.id);
}
