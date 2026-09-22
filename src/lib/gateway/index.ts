import "server-only";
import { PaymentGateway } from "./types";
import { MockGateway } from "./mock";
import { AsaasGateway } from "./asaas";

/** true = gateway real (Asaas) conectado; false = simulação (sem ASAAS_API_KEY). */
export const gatewayReal = !!process.env.ASAAS_API_KEY;

/**
 * Ponto único de acesso ao gateway de pagamento: usa o Asaas quando
 * ASAAS_API_KEY está configurada, senão cai na simulação — assim o portal
 * continua testável localmente sem credenciais reais.
 */
export const paymentGateway: PaymentGateway = gatewayReal ? new AsaasGateway() : new MockGateway();
