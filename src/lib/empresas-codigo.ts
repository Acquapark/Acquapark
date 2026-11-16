/**
 * Código de validação da empresa parceira: o próprio CNPJ dela, só os 14
 * números. O funcionário pode digitar com ou sem pontos, barra e traço.
 * Mesmo formato gravado pelo script supabase/empresas_parceiras_codigo_cnpj.sql
 * para as empresas que já existiam.
 *
 * Módulo puro: a normalização também roda no navegador.
 */
export const CODIGO_EMPRESA_TAMANHO = 14;

/** Só os números — aceita o CNPJ digitado com ou sem pontuação. */
export function normalizarCodigoEmpresa(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, CODIGO_EMPRESA_TAMANHO);
}

/** Código gravado para a empresa a partir do CNPJ do cadastro dela. */
export function codigoDoCnpj(cnpj: string): string {
  return normalizarCodigoEmpresa(cnpj);
}
