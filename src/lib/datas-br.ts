const TZ = "America/Sao_Paulo";

/** Data de hoje (YYYY-MM-DD) no horário de Brasília. */
export function hojeBR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Converte um timestamp ISO para a data (YYYY-MM-DD) no horário de Brasília. */
export function dataBR(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

export function mesAtualBR(): string {
  return hojeBR().slice(0, 7);
}

export function mesValido(mes: string | undefined): mes is string {
  return !!mes && (mes === "todos" || /^\d{4}-(0[1-9]|1[0-2])$/.test(mes));
}

/** Primeiro dia do mês e primeiro dia do mês seguinte (YYYY-MM-DD). */
export function limitesDoMes(mes: string): { de: string; ate: string } {
  const [ano, m] = mes.split("-").map(Number);
  const proximo = m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, "0")}`;
  return { de: `${mes}-01`, ate: `${proximo}-01` };
}

/** "2026-09" -> "2026-08" (mês anterior). */
export function mesAnterior(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return m === 1 ? `${ano - 1}-12` : `${ano}-${String(m - 1).padStart(2, "0")}`;
}

/** Início e fim (exclusivo) de um dia YYYY-MM-DD, em timestamptz de Brasília — para filtrar `gte`/`lt` em colunas timestamptz. */
export function janelaDoDiaBR(dia: string): { inicio: string; fim: string } {
  return { inicio: `${dia}T00:00:00-03:00`, fim: `${somarDias(dia, 1)}T00:00:00-03:00` };
}

/** "2026-09" -> "setembro de 2026". */
export function rotuloMes(mes: string): string {
  if (mes === "todos") return "Todos os períodos";
  const texto = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Os últimos `quantidade` meses, do mais recente para o mais antigo, a partir de `hoje`. */
export function ultimosMeses(hoje: string, quantidade = 12): string[] {
  let [ano, mes] = hoje.slice(0, 7).split("-").map(Number);
  const lista: string[] = [];
  for (let i = 0; i < quantidade; i++) {
    lista.push(`${ano}-${String(mes).padStart(2, "0")}`);
    mes -= 1;
    if (mes === 0) {
      mes = 12;
      ano -= 1;
    }
  }
  return lista;
}

/** Soma `dias` a uma data YYYY-MM-DD (calendário, sem fuso). */
export function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** Diferença em dias inteiros entre duas datas YYYY-MM-DD (b - a). */
export function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Hora cheia (0-23) de um timestamp no horário de Brasília. */
export function horaBR(iso: string): number {
  const texto = new Date(iso).toLocaleString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false });
  return Number(texto.slice(0, 2)) % 24;
}

const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

/** Índice (0=domingo) e nome do dia da semana de uma data YYYY-MM-DD. */
export function diaDaSemana(iso: string): { indice: number; nome: string } {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const indice = new Date(Date.UTC(ano, mes - 1, dia, 12)).getUTCDay();
  return { indice, nome: DIAS_SEMANA[indice] };
}
