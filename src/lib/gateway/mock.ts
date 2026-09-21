import { BoletoCharge, CardCheckout, PaymentGateway, PixCharge } from "./types";

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/**
 * Implementação simulada do gateway — sem nenhuma integração externa real.
 * Gera identificadores/payloads plausíveis para exercitar toda a arquitetura
 * (cobrança → confirmação → webhook → mensalidade paga) sem depender de uma
 * conta em um provedor real.
 */
export class MockGateway implements PaymentGateway {
  async criarCobrancaPix({ mensalidadeId, valor }: { mensalidadeId: string; valor: number; descricao: string }): Promise<PixCharge> {
    const chargeId = randomId("pix");
    const expiraEm = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    // Payload no formato BR Code (EMV) — fictício, só para o QR ter uma cara real.
    const copiaECola = `00020126580014BR.GOV.BCB.PIX0136${chargeId}5204000053039865406${valor.toFixed(2)}5802BR5913AQUA PARK6009SAO PAULO62070503***6304${mensalidadeId.slice(0, 4).toUpperCase()}`;
    return { chargeId, copiaECola, valor, expiraEm };
  }

  async criarCobrancaBoleto({
    valor,
    vencimento,
  }: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
  }): Promise<BoletoCharge> {
    const chargeId = randomId("bol");
    const linhaDigitavel = `34191.79001 01043.510047 91020.150008 8 ${Date.now().toString().slice(-14)}`;
    return { chargeId, linhaDigitavel, urlBoleto: `https://mock-gateway.local/boletos/${chargeId}.pdf`, valor, vencimento };
  }

  async criarCheckoutCartao({ valor }: { mensalidadeId: string; valor: number; descricao: string }): Promise<CardCheckout> {
    const chargeId = randomId("card");
    return { chargeId, checkoutUrl: `https://mock-gateway.local/checkout/${chargeId}`, valor };
  }
}

export const paymentGateway: PaymentGateway = new MockGateway();
