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

/** Tipo de cobrança do lado do gateway — "Undefined" deixa o pagador escolher depois (usado na criação antecipada). */
export type TipoCobranca = "Pix" | "Boleto" | "Cartão" | "Undefined";

/** Estado resumido de uma cobrança já existente no gateway — usado pela sincronização, edição de vencimento e cancelamento. */
export interface CobrancaResumo {
  chargeId: string;
  /** Status bruto do gateway (ex: "PENDING", "RECEIVED", "OVERDUE") — nunca confundir com o status de negócio local da mensalidade. */
  status: string;
  tipo: TipoCobranca;
  vencimento: string;
  valor: number;
  invoiceUrl: string;
}

export interface PaymentGateway {
  criarCobrancaPix(params: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
    /** Se a cobrança já existir no gateway (criação antecipada), atualiza-a em vez de criar outra. */
    chargeIdExistente?: string;
  }): Promise<PixCharge>;
  criarCobrancaBoleto(params: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
    chargeIdExistente?: string;
  }): Promise<BoletoCharge>;
  criarCheckoutCartao(params: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
    chargeIdExistente?: string;
  }): Promise<CardCheckout>;
  /** Cria a cobrança com o método de pagamento "a definir" — o pagador escolhe depois. Usada na criação antecipada, no momento da adesão. */
  criarCobrancaPendente(params: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
  }): Promise<CobrancaResumo>;
  /** Consulta o estado atual de uma cobrança já existente. */
  buscarCobranca(chargeId: string): Promise<CobrancaResumo | null>;
  /** Atualiza vencimento/valor/tipo de uma cobrança existente. Só funciona enquanto ela estiver pendente ou vencida no gateway. */
  atualizarCobranca(
    chargeId: string,
    params: { tipo: TipoCobranca; valor: number; vencimento: string },
  ): Promise<CobrancaResumo>;
  /** Cancela (remove) a cobrança no gateway. Não representa estorno de um pagamento já confirmado. */
  cancelarCobranca(chargeId: string): Promise<{ cancelada: boolean }>;
}
