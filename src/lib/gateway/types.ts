/**
 * Abstração do gateway de pagamento (seção 8-10, 22 do PRD do Portal).
 * `MockGateway` simula as respostas para testar o fluxo ponta a ponta
 * (cobrança → webhook → mensalidade paga) sem credenciais reais; `AsaasGateway`
 * é a integração real com o Asaas. `src/lib/gateway/index.ts` escolhe qual das
 * duas usar — o resto do sistema chama sempre esta mesma interface.
 */

/** Quem está pagando — todo gateway real precisa disso para criar o cliente/cobrança. */
export interface Pagador {
  associadoId: string;
  nome: string;
  cpf: string;
  email?: string;
  telefone?: string;
}

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
  criarCobrancaPix(params: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
  }): Promise<PixCharge>;
  criarCobrancaBoleto(params: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
  }): Promise<BoletoCharge>;
  criarCheckoutCartao(params: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
  }): Promise<CardCheckout>;
}
