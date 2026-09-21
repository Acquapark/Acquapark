/**
 * Geração de mensalidades a partir das regras do plano (seção 12-15 do PRD).
 * Roda exclusivamente no backend — nunca no cliente.
 */

export interface ParcelaGerada {
  numeroParcela: number;
  totalParcelas: number;
  vencimento: string; // YYYY-MM-DD
  valor: number;
}

function toDateOnly(year: number, month: number, day: number): Date {
  // Clampa para o último dia do mês quando o dia de vencimento não existe
  // nesse mês (ex: dia 31 em fevereiro).
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Primeira parcela vence na primeira ocorrência do `diaVencimento`
 * estritamente posterior à data de início do contrato.
 */
export function calcularPrimeiroVencimento(dataInicioISO: string, diaVencimento: number): Date {
  const inicio = new Date(`${dataInicioISO}T00:00:00Z`);
  let year = inicio.getUTCFullYear();
  let month = inicio.getUTCMonth();

  let candidato = toDateOnly(year, month, diaVencimento);
  if (candidato.getTime() <= inicio.getTime()) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    candidato = toDateOnly(year, month, diaVencimento);
  }
  return candidato;
}

export function gerarParcelas(params: {
  dataInicio: string; // YYYY-MM-DD
  diaVencimento: number;
  quantidadeMensalidades: number;
  valor: number;
  /**
   * Override do vencimento da 1ª parcela (regra "Usar data da adesão" ou
   * "Definir manualmente na contratação" do plano). Quando informado, as
   * demais parcelas continuam seguindo normalmente a regra padrão do plano
   * (mesmo calendário de sempre, só descartando o último slot para manter a
   * quantidade de parcelas definida no plano).
   */
  primeiraParcelaVencimento?: string; // YYYY-MM-DD
}): ParcelaGerada[] {
  const { dataInicio, diaVencimento, quantidadeMensalidades, valor, primeiraParcelaVencimento } = params;
  const primeiro = calcularPrimeiroVencimento(dataInicio, diaVencimento);

  const vencimentos: Date[] = [];
  let year = primeiro.getUTCFullYear();
  let month = primeiro.getUTCMonth();

  for (let i = 0; i < quantidadeMensalidades; i++) {
    vencimentos.push(toDateOnly(year, month, diaVencimento));
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  if (primeiraParcelaVencimento && vencimentos.length > 0) {
    vencimentos.pop();
    vencimentos.unshift(new Date(`${primeiraParcelaVencimento}T00:00:00Z`));
  }

  return vencimentos.map((vencimento, i) => ({
    numeroParcela: i + 1,
    totalParcelas: quantidadeMensalidades,
    vencimento: toISODate(vencimento),
    valor,
  }));
}
