/** Dados enviados pela página pública /cadastro (a foto vai à parte, como arquivo). */
export interface AutocadastroDependente {
  nome: string;
  cpf: string;
  parentesco: string;
  nascimento: string;
}

export interface AutocadastroDados {
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
  planoId: string;
  dependentes: AutocadastroDependente[];
  senha: string;
  aceiteTermos: boolean;
  /** Versão dos termos que a pessoa leu e aceitou na página. */
  termosVersaoId: string;
}

/** O que a página pública pode saber de um plano — nada além do que já é divulgado. */
export interface PlanoAutocadastro {
  id: string;
  nome: string;
  valor: number;
  dependentesPermitidos: number;
  beneficios: string[];
  quantidadeMensalidades: number;
  diaVencimento: number;
  vencimentoNaContratacao: boolean;
}

/** Limite dos leitores faciais Hikvision (a foto do associado vai para o aparelho). */
export const FOTO_TAMANHO_MAXIMO = 200 * 1024;
export const SENHA_TAMANHO_MINIMO = 8;
