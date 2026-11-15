import { Dependente } from "@/types";
import type { CupomPlano } from "@/lib/cupom-plano";

export interface AssociadoFormState {
  // Etapa 1 — Dados básicos
  nome: string;
  cpf: string;
  rg: string;
  nascimento: string;
  sexo: string;
  telefone: string;
  whatsapp: string;
  email: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  observacoes: string;
  /** Empresa parceira de onde o associado veio ("" = nenhuma). */
  empresaParceiraId: string;

  // Etapa 2 — Dependentes
  dependentes: Dependente[];

  // Etapa 3 — Plano
  planoId: string;
  dataInicio: string;
  diaVencimento: string;
  primeiraParcelaData: string;
  valorMensalidade: string;
  formaPagamento: string;
  desconto: string;
  /** Cupom de plano já conferido (o uso só é consumido ao salvar). */
  cupom: CupomPlano | null;
  planoObservacoes: string;

  // Etapa 4 — Contrato
  numeroContrato: string;
  contratoObservacoes: string;
}

export const emptyAssociadoForm: AssociadoFormState = {
  nome: "",
  cpf: "",
  rg: "",
  nascimento: "",
  sexo: "",
  telefone: "",
  whatsapp: "",
  email: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  observacoes: "",
  empresaParceiraId: "",
  dependentes: [],
  planoId: "",
  dataInicio: "",
  diaVencimento: "",
  primeiraParcelaData: "",
  valorMensalidade: "",
  formaPagamento: "",
  desconto: "",
  cupom: null,
  planoObservacoes: "",
  numeroContrato: "",
  contratoObservacoes: "",
};

export const STEPS = [
  "Dados Básicos",
  "Plano",
  "Dependentes",
  "Contrato",
  "Financeiro",
  "Acessos",
  "Credencial",
];
