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
