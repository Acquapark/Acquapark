import { BoletoCharge, CardCheckout, CobrancaResumo, Pagador, PaymentGateway, PixCharge, TipoCobranca } from "./types";

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** Estado em memória das cobranças simuladas — só dura enquanto o processo do servidor dev estiver rodando, o suficiente pra exercitar buscar/atualizar/cancelar. */
const cobrancasSimuladas = new Map<string, CobrancaResumo>();

/**
 * Implementação simulada do gateway — sem nenhuma integração externa real.
 * Gera identificadores/payloads plausíveis para exercitar toda a arquitetura
 * (cobrança → confirmação → webhook → mensalidade paga) sem depender de uma
 * conta em um provedor real. Usada automaticamente quando ASAAS_API_KEY não
 * está configurada (veja `src/lib/gateway/index.ts`).
 */
export class MockGateway implements PaymentGateway {
  async criarCobrancaPix({
    mensalidadeId,
    valor,
    vencimento,
    chargeIdExistente,
  }: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
    chargeIdExistente?: string;
  }): Promise<PixCharge> {
    const chargeId = chargeIdExistente ?? randomId("pix");
    const expiraEm = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    // Payload no formato BR Code (EMV) — fictício, só para o QR ter uma cara real.
    const copiaECola = `00020126580014BR.GOV.BCB.PIX0136${chargeId}5204000053039865406${valor.toFixed(2)}5802BR5913AQUA PARK6009SAO PAULO62070503***6304${mensalidadeId.slice(0, 4).toUpperCase()}`;
    cobrancasSimuladas.set(chargeId, { chargeId, status: "PENDING", tipo: "Pix", vencimento, valor, invoiceUrl: `https://mock-gateway.local/faturas/${chargeId}` });
    return { chargeId, copiaECola, valor, expiraEm };
  }

  async criarCobrancaBoleto({
    valor,
    vencimento,
    chargeIdExistente,
  }: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
    chargeIdExistente?: string;
  }): Promise<BoletoCharge> {
    const chargeId = chargeIdExistente ?? randomId("bol");
    const linhaDigitavel = `34191.79001 01043.510047 91020.150008 8 ${Date.now().toString().slice(-14)}`;
    const urlBoleto = `https://mock-gateway.local/boletos/${chargeId}.pdf`;
    cobrancasSimuladas.set(chargeId, { chargeId, status: "PENDING", tipo: "Boleto", vencimento, valor, invoiceUrl: urlBoleto });
    return { chargeId, linhaDigitavel, urlBoleto, valor, vencimento };
  }

  async criarCheckoutCartao({
    valor,
    vencimento,
    chargeIdExistente,
  }: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
    chargeIdExistente?: string;
  }): Promise<CardCheckout> {
    const chargeId = chargeIdExistente ?? randomId("card");
    const checkoutUrl = `https://mock-gateway.local/checkout/${chargeId}`;
    cobrancasSimuladas.set(chargeId, { chargeId, status: "PENDING", tipo: "Cartão", vencimento, valor, invoiceUrl: checkoutUrl });
    return { chargeId, checkoutUrl, valor };
  }

  async criarCobrancaPendente({ valor, vencimento }: { mensalidadeId: string; valor: number; vencimento: string; descricao: string; pagador: Pagador }): Promise<CobrancaResumo> {
    const chargeId = randomId("pay");
    const resumo: CobrancaResumo = { chargeId, status: "PENDING", tipo: "Undefined", vencimento, valor, invoiceUrl: `https://mock-gateway.local/faturas/${chargeId}` };
    cobrancasSimuladas.set(chargeId, resumo);
    return resumo;
  }

  async buscarCobranca(chargeId: string): Promise<CobrancaResumo | null> {
    return cobrancasSimuladas.get(chargeId) ?? null;
  }

  async atualizarCobranca(chargeId: string, params: { tipo: TipoCobranca; valor: number; vencimento: string }): Promise<CobrancaResumo> {
    const existente = cobrancasSimuladas.get(chargeId);
    if (!existente) throw new Error("Cobrança simulada não encontrada.");
    const atualizada: CobrancaResumo = { ...existente, tipo: params.tipo, valor: params.valor, vencimento: params.vencimento };
    cobrancasSimuladas.set(chargeId, atualizada);
    return atualizada;
  }

  async cancelarCobranca(chargeId: string): Promise<{ cancelada: boolean }> {
    return { cancelada: cobrancasSimuladas.delete(chargeId) || true };
  }
}

export const paymentGateway: PaymentGateway = new MockGateway();
