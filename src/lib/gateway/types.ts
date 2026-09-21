/**
 * Abstração do gateway de pagamento (seção 8-10, 22 do PRD do Portal).
 * Nenhuma integração real está implementada — `MockGateway` simula as
 * respostas para permitir testar o fluxo ponta a ponta (cobrança → webhook
 * → mensalidade paga). Trocar por um gateway real (Asaas etc.) significa
 * escrever uma nova classe que implementa esta mesma interface — nada mais
 * no resto do sistema precisa mudar.
 */

export interface PixCharge {
  chargeId: string;
  /** Payload copia-e-cola — o QR Code é renderizado no cliente a partir deste valor. */
  copiaECola: string;
  valor: number;
  expiraEm: string;
}

export interface BoletoCharge {
  chargeId: string;
  linhaDigitavel: string;
  urlBoleto: string;
  valor: number;
  vencimento: string;
}

export interface CardCheckout {
  chargeId: string;
  checkoutUrl: string;
  valor: number;
}

export interface PaymentGateway {
  criarCobrancaPix(params: { mensalidadeId: string; valor: number; descricao: string }): Promise<PixCharge>;
  criarCobrancaBoleto(params: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
  }): Promise<BoletoCharge>;
  criarCheckoutCartao(params: { mensalidadeId: string; valor: number; descricao: string }): Promise<CardCheckout>;
}
