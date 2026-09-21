import { Dependente } from "@/types";

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
  planoObservacoes: string;

  // Etapa 4 — Contrato
  numeroContrato: string;
  dataContratacao: string;
  contratoInicio: string;
  contratoFim: string;
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
  dependentes: [],
  planoId: "",
  dataInicio: "",
  diaVencimento: "",
  primeiraParcelaData: "",
  valorMensalidade: "",
  formaPagamento: "",
  desconto: "",
  planoObservacoes: "",
  numeroContrato: "",
  dataContratacao: "",
  contratoInicio: "",
  contratoFim: "",
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
