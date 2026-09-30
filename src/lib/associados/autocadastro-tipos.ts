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

export const FOTO_TAMANHO_MAXIMO = 900 * 1024;
export const SENHA_TAMANHO_MINIMO = 8;
