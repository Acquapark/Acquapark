import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hojeBR, somarDias } from "@/lib/datas-br";
import { enviarEmail, escaparHtml } from "@/lib/email";
import { formatCurrency, formatDate } from "@/lib/utils";

/**
 * Venda de ingressos online (/comprar). O pedido nasce "Aguardando pagamento"
 * (função criar_pedido_online, que calcula preços e respeita o limite do dia)
 * e os ingressos só são emitidos quando a Asaas confirma o pagamento
 * (emitir_ingressos_pedido_online, chamada pelo webhook). Tudo pelo cliente
 * com service role: o público não acessa as tabelas.
 */

export const MINUTOS_PARA_PAGAR = 30;

export interface ConfigVendaOnline {
  ativa: boolean;
  /** null = sem limite. */
  limiteDiario: number | null;
  /** "HH:MM" — até quando se compra para o próprio dia. */
  horaLimite: string;
  diasAntecedencia: number;
}

export interface TipoOnline {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  semExpiracao: boolean;
}

export interface IngressoDoPedido {
  numero: string;
  codigo: string;
  tipo: string;
  dataUtilizacao: string;
  semExpiracao: boolean;
  status: string;
}

export interface PedidoOnline {
  id: string;
  numero: string;
  token: string;
  compradorNome: string;
  compradorEmail: string;
  compradorCpf: string;
  compradorTelefone: string;
  dataUtilizacao: string;
  itens: { nome: string; quantidade: number; valorUnitario: number; valorDesconto: number }[];
  quantidade: number;
  valorTotal: number;
  formaPagamento: "Pix" | "Cartão de crédito";
  /** "Expirado" é calculado: aguardando pagamento depois do prazo. */
  status: "Aguardando pagamento" | "Pago" | "Expirado" | "Cancelado";
  pixCopiaECola: string | null;
  checkoutUrl: string | null;
  expiraEm: string;
  pagoEm: string | null;
  emailEnviadoEm: string | null;
  criadoEm: string;
}

type Row = Record<string, unknown>;

export function urlDoSite() {
  return (process.env.SITE_URL || "https://meuacquapark.com").replace(/\/$/, "");
}

export async function getConfigVendaOnline(supabase: SupabaseClient): Promise<ConfigVendaOnline> {
  const { data } = await supabase
    .from("empresa")
    .select("venda_online_ativa, venda_online_limite_diario, venda_online_hora_limite, venda_online_dias_antecedencia")
    .eq("id", true)
    .maybeSingle();
  return {
    ativa: Boolean(data?.venda_online_ativa),
    limiteDiario: (data?.venda_online_limite_diario as number | null) ?? null,
    horaLimite: ((data?.venda_online_hora_limite as string) ?? "14:00").slice(0, 5),
    diasAntecedencia: (data?.venda_online_dias_antecedencia as number) ?? 60,
  };
}

export async function getTiposOnline(supabase: SupabaseClient): Promise<TipoOnline[]> {
  const { data, error } = await supabase
    .from("tipos_ingresso")
    .select("id, nome, descricao, valor, sem_expiracao")
    .eq("ativo", true)
    .eq("disponivel_online", true)
    .order("valor", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map((t) => ({
    id: t.id as string,
    nome: t.nome as string,
    descricao: (t.descricao as string) ?? "",
    valor: Number(t.valor),
    semExpiracao: Boolean(t.sem_expiracao),
  }));
}

/** Datas que podem ser escolhidas agora: [primeira, última] e se hoje ainda está aberto. */
export function janelaDeDatas(config: ConfigVendaOnline): { primeira: string; ultima: string; hojeAberto: boolean } {
  const hoje = hojeBR();
  const agora = new Date().toLocaleTimeString("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const hojeAberto = agora < config.horaLimite;
  return { primeira: hojeAberto ? hoje : somarDias(hoje, 1), ultima: somarDias(hoje, config.diasAntecedencia), hojeAberto };
}

/** Datas (YYYY-MM-DD) em que o parque abre, dentro do intervalo — escolhidas uma a uma no painel. */
export async function getDatasAbertas(supabase: SupabaseClient, de: string, ate: string): Promise<string[]> {
  const { data } = await supabase.from("datas_funcionamento").select("data").gte("data", de).lte("data", ate).order("data");
  return ((data ?? []) as Row[]).map((d) => d.data as string);
}

/** Ingressos online ainda disponíveis na data (null = sem limite). Conta pagos e reservas no prazo. */
export async function ingressosRestantes(supabase: SupabaseClient, config: ConfigVendaOnline, data: string): Promise<number | null> {
  if (config.limiteDiario === null) return null;
  const { data: pedidos } = await supabase
    .from("pedidos_online")
    .select("quantidade, status, expira_em")
    .eq("data_utilizacao", data)
    .in("status", ["Pago", "Aguardando pagamento"]);
  const agora = Date.now();
  const ocupados = ((pedidos ?? []) as Row[])
    .filter((p) => p.status === "Pago" || new Date(p.expira_em as string).getTime() > agora)
    .reduce((s, p) => s + (p.quantidade as number), 0);
  return Math.max(0, config.limiteDiario - ocupados);
}

export function mapPedido(row: Row): PedidoOnline {
  const status = row.status as string;
  const expirado = status === "Aguardando pagamento" && new Date(row.expira_em as string).getTime() < Date.now();
  return {
    id: row.id as string,
    numero: row.numero as string,
    token: row.token as string,
    compradorNome: row.comprador_nome as string,
    compradorEmail: row.comprador_email as string,
    compradorCpf: row.comprador_cpf as string,
    compradorTelefone: row.comprador_telefone as string,
    dataUtilizacao: row.data_utilizacao as string,
    itens: ((row.itens as Row[]) ?? []).map((i) => ({
      nome: i.nome as string,
      quantidade: Number(i.quantidade),
      valorUnitario: Number(i.valor_unitario),
      valorDesconto: Number(i.valor_desconto),
    })),
    quantidade: row.quantidade as number,
    valorTotal: Number(row.valor_total),
    formaPagamento: row.forma_pagamento as PedidoOnline["formaPagamento"],
    status: expirado ? "Expirado" : (status as PedidoOnline["status"]),
    pixCopiaECola: (row.pix_copia_e_cola as string) ?? null,
    checkoutUrl: (row.checkout_url as string) ?? null,
    expiraEm: row.expira_em as string,
    pagoEm: (row.pago_em as string) ?? null,
    emailEnviadoEm: (row.email_enviado_em as string) ?? null,
    criadoEm: row.criado_em as string,
  };
}

export async function getPedidoPorToken(
  supabase: SupabaseClient,
  token: string,
): Promise<{ pedido: PedidoOnline; ingressos: IngressoDoPedido[] } | null> {
  if (!/^[0-9a-f]{20,64}$/.test(token)) return null;
  const { data } = await supabase.from("pedidos_online").select("*").eq("token", token).maybeSingle();
  if (!data) return null;
  const pedido = mapPedido(data as Row);
  return { pedido, ingressos: await getIngressosDoPedido(supabase, pedido.id) };
}

async function getIngressosDoPedido(supabase: SupabaseClient, pedidoId: string): Promise<IngressoDoPedido[]> {
  const { data } = await supabase
    .from("ingressos")
    .select("numero, codigo, data_utilizacao, sem_expiracao, status, tipos_ingresso ( nome )")
    .eq("pedido_online_id", pedidoId)
    .order("numero");
  return ((data ?? []) as Row[]).map((i) => ({
    numero: i.numero as string,
    codigo: i.codigo as string,
    tipo: ((i.tipos_ingresso as Row | null)?.nome as string) ?? "Ingresso",
    dataUtilizacao: i.data_utilizacao as string,
    semExpiracao: Boolean(i.sem_expiracao),
    status: i.status as string,
  }));
}

/**
 * Emite os ingressos do pedido (idempotente) e manda o e-mail na primeira vez.
 * Chamada pelo webhook da Asaas, pelo pagamento simulado e por pedidos de
 * valor zero (cupom de 100%).
 */
export async function confirmarPedidoOnline(pedidoId: string, forma?: string): Promise<{ error: string } | { success: true }> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("emitir_ingressos_pedido_online", { p_pedido_id: pedidoId, p_forma: forma ?? null });
  if (error) return { error: error.message };

  const { data } = await admin.from("pedidos_online").select("email_enviado_em").eq("id", pedidoId).maybeSingle();
  if (!data?.email_enviado_em) {
    const envio = await enviarEmailDoPedido(admin, pedidoId);
    if ("error" in envio) console.error(`[venda online] e-mail do pedido ${pedidoId} não enviado:`, envio.error);
  }
  return { success: true };
}

/** Webhook: se a cobrança é de um pedido online, confirma. null = não é de pedido online. */
export async function confirmarPedidoOnlinePorCobranca(chargeId: string, forma: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("pedidos_online").select("id").eq("gateway_charge_id", chargeId).maybeSingle();
  if (!data) return null;
  return confirmarPedidoOnline(data.id as string, forma);
}

export async function enviarEmailDoPedido(supabase: SupabaseClient, pedidoId: string): Promise<{ ok: true } | { error: string }> {
  const { data } = await supabase.from("pedidos_online").select("*").eq("id", pedidoId).maybeSingle();
  if (!data) return { error: "Pedido não encontrado." };
  const pedido = mapPedido(data as Row);
  if (pedido.status !== "Pago") return { error: "O pedido ainda não foi pago." };

  const link = `${urlDoSite()}/comprar/pedido/${pedido.token}`;
  const itens = pedido.itens
    .map((i) => `<li>${i.quantidade} × ${escaparHtml(i.nome)} — ${formatCurrency(i.valorUnitario)}</li>`)
    .join("");
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2430;max-width:520px">
      <h2 style="color:#1d4ed8">Seus ingressos do Acqua Park</h2>
      <p>Olá, ${escaparHtml(pedido.compradorNome.split(" ")[0])}! O pagamento do pedido <strong>${pedido.numero}</strong> foi confirmado.</p>
      <p><strong>Data da visita:</strong> ${formatDate(pedido.dataUtilizacao)}</p>
      <ul>${itens}</ul>
      <p><strong>Total:</strong> ${formatCurrency(pedido.valorTotal)}</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Ver meus ingressos (QR Code)</a>
      </p>
      <p style="font-size:13px;color:#6b7385">Apresente o QR Code de cada ingresso na entrada do parque. Guarde este e-mail: o link acima mostra seus ingressos a qualquer momento.</p>
      <p style="font-size:12px;color:#9aa3b2">Ingressos sem cancelamento ou reembolso.</p>
    </div>`;

  const envio = await enviarEmail({ para: pedido.compradorEmail, assunto: `Seus ingressos — pedido ${pedido.numero}`, html });
  if ("ok" in envio) {
    await supabase.from("pedidos_online").update({ email_enviado_em: new Date().toISOString() }).eq("id", pedidoId);
  }
  return envio;
}

export async function getPedidosOnline(supabase: SupabaseClient, limite = 200): Promise<PedidoOnline[]> {
  const { data, error } = await supabase.from("pedidos_online").select("*").order("criado_em", { ascending: false }).limit(limite);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(mapPedido);
}
