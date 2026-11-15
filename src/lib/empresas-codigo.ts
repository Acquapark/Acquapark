/**
 * Código de validação da empresa parceira: 8 caracteres de 0-9 e A-F (não tem
 * O, I nem L, que se confundem com 0 e 1). Mesmo formato gerado pelo script
 * supabase/empresas_parceiras_codigo.sql para as empresas que já existiam.
 *
 * Módulo puro: a normalização também roda no navegador.
 */
export const CODIGO_EMPRESA_TAMANHO = 8;

/** Maiúsculas e só letras/números — aceita o que a pessoa digitar com espaço ou traço. */
export function normalizarCodigoEmpresa(valor: string): string {
  return valor
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, CODIGO_EMPRESA_TAMANHO);
}

export function gerarCodigoEmpresa(): string {
  const bytes = new Uint8Array(CODIGO_EMPRESA_TAMANHO / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
