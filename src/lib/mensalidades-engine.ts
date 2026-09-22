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
  /**
   * Vencimento "aniversário": todas as parcelas vencem no dia do mês da
   * própria data de início (contratou dia 21 -> 21/09, 21/10, 21/11...). Ignora
   * `diaVencimento` e `primeiraParcelaVencimento`. Mês mais curto usa o último
   * dia, sem "arrastar" o dia para os meses seguintes (31/01 -> 28/02 -> 31/03).
   */
  vencimentoNaContratacao?: boolean;
}): ParcelaGerada[] {
  const { dataInicio, diaVencimento, quantidadeMensalidades, valor, primeiraParcelaVencimento, vencimentoNaContratacao } =
    params;

  if (vencimentoNaContratacao) {
    const [ano, mes, dia] = dataInicio.split("-").map(Number);
    return Array.from({ length: quantidadeMensalidades }, (_, i) => {
      const deslocamento = mes - 1 + i;
      const vencimento = toDateOnly(ano + Math.floor(deslocamento / 12), deslocamento % 12, dia);
      return { numeroParcela: i + 1, totalParcelas: quantidadeMensalidades, vencimento: toISODate(vencimento), valor };
    });
  }

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

/**
 * Aplica um desconto percentual (0-100) sobre um valor base, arredondando para
 * centavos. Percentuais fora da faixa são recortados (negativo vira 0, acima
 * de 100 vira 100) em vez de gerar um valor negativo ou maior que o original.
 */
export function valorComDesconto(valorBase: number, descontoPercentual: number): number {
  const percentual = Math.min(100, Math.max(0, descontoPercentual || 0));
  return Math.round(valorBase * (1 - percentual / 100) * 100) / 100;
}

/** Regras do plano que definem as datas das parcelas (o que a contratação precisa conhecer). */
export interface RegrasDoPlano {
  diaVencimento: number;
  quantidadeMensalidades: number;
  regraPrimeiraParcela: "padrao" | "adesao" | "manual";
  vencimentoNaContratacao: boolean;
}

/**
 * Parcelas que serão geradas para um plano, aplicando todas as regras dele.
 * É a mesma conta do servidor, usada na pré-visualização antes de confirmar.
 * Retorna [] enquanto faltar dado (data de início, ou a data manual exigida).
 */
export function parcelasDoPlano(
  plano: RegrasDoPlano,
  dataInicio: string,
  valor: number,
  primeiraParcelaManual?: string,
): ParcelaGerada[] {
  if (!dataInicio) return [];

  if (plano.vencimentoNaContratacao) {
    return gerarParcelas({ dataInicio, diaVencimento: plano.diaVencimento, quantidadeMensalidades: plano.quantidadeMensalidades, valor, vencimentoNaContratacao: true });
  }
  if (plano.regraPrimeiraParcela === "manual" && !primeiraParcelaManual) return [];

  return gerarParcelas({
    dataInicio,
    diaVencimento: plano.diaVencimento,
    quantidadeMensalidades: plano.quantidadeMensalidades,
    valor,
    primeiraParcelaVencimento:
      plano.regraPrimeiraParcela === "adesao"
        ? dataInicio
        : plano.regraPrimeiraParcela === "manual"
          ? primeiraParcelaManual
          : undefined,
  });
}
