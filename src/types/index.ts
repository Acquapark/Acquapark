export type AssociadoStatus = "Ativo" | "Pendente" | "Inadimplente" | "Suspenso" | "Inativo";
export type MensalidadeStatus = "Pago" | "Pendente" | "Vencido" | "Cancelado" | "Em processamento";
export type AcessoTipo = "Entrada" | "Saída" | "Reentrada";
export type AcessoResultado = "Autorizado" | "Negado" | "Bloqueado";
export type IngressoStatus = "Disponível" | "Utilizado" | "Cancelado" | "Expirado";
export type CatracaStatus = "Online" | "Offline" | "Manutenção";
export type ContratoStatus = "Ativo" | "Finalizado" | "Cancelado";
export type RegraPrimeiraParcela = "padrao" | "adesao" | "manual";
export type FormaPagamento = "Pix" | "Cartão de crédito" | "Boleto";

export interface Plano {
  id: string;
  nome: string;
  valor: number;
  dependentesPermitidos: number;
  beneficios: string[];
  quantidadeMensalidades: number;
  diaVencimento: number;
  regraPrimeiraParcela: RegraPrimeiraParcela;
  ativo: boolean;
}

/** O contrato de associação — snapshot das condições no momento da contratação. */
export interface Contrato {
  id: string;
  numero: string;
  associadoId: string;
  planoId: string | null;
  planoNome: string;
  dataContratacao: string;
  dataInicio: string;
  dataFim: string | null;
  valor: number;
  quantidadeMensalidades: number;
  regraPrimeiraParcela: RegraPrimeiraParcela;
  status: ContratoStatus;
}

export interface Dependente {
  id: string;
  nome: string;
  cpf: string;
  parentesco: string;
  nascimento: string;
  status: "Ativo" | "Inativo";
}

export interface Mensalidade {
  id: string;
  contratoId?: string;
  numeroParcela?: number;
  totalParcelas?: number;
  vencimento: string;
  valor: number;
  status: MensalidadeStatus;
  formaPagamento?: string;
  pagamentoEm?: string;
  gatewayChargeId?: string;
}

export interface AcessoRegistro {
  id: string;
  data: string;
  horario: string;
  tipo: AcessoTipo;
  catraca: string;
  resultado: AcessoResultado;
  motivo?: string;
}

export interface Associado {
  id: string;
  numero: string;
  nome: string;
  cpf: string;
  rg?: string;
  nascimento?: string;
  email: string;
  telefone: string;
  cep?: string;
  endereco?: string;
  numeroEndereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  plano: string;
  status: AssociadoStatus;
  mensalidade: number;
  vencimento: string;
  ultimoAcesso: string;
  fotoUrl?: string;
  dependentes: Dependente[];
  mensalidades: Mensalidade[];
  acessos: AcessoRegistro[];
}

export interface TipoIngresso {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  validade: string;
}

export interface Ingresso {
  id: string;
  numero: string;
  tipo: string;
  dataUtilizacao: string;
  valor: number;
  status: IngressoStatus;
  comprador: string;
}

export interface Catraca {
  id: string;
  nome: string;
  local: string;
  tipo: "Entrada" | "Saída" | "Bidirecional";
  status: CatracaStatus;
}

export interface AcessoAssociado {
  id: string;
  associadoId: string;
  email: string;
  status: "Ativo" | "Bloqueado";
  ultimoAcesso: string | null;
}

export interface Despesa {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  vencimento: string;
  status: "Pago" | "Pendente" | "Vencido";
}
